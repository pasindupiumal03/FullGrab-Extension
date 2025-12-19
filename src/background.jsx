
// Background script

// Ensure offscreen document exists
async function setupOffscreenDocument(path) {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: path,
    reasons: ['BLOBS'],
    justification: 'Stitching screenshots',
  });
}

// Inject content script if not present
async function ensureContentScript(tabId) {
  try {
    // Check by pinging
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch (err) {
    console.log('Injecting content script into tab', tabId);
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    // Wait for script to initialize
    await new Promise(r => setTimeout(r, 250));
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CAPTURE_VISIBLE') {
    handleCaptureVisible();
  } else if (request.type === 'CAPTURE_FULL_PAGE') {
    handleCaptureFullPage();
  }
  return true;
});

async function handleCaptureVisible() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Capture
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

    // Clear storage first to avoid quota issues with old data
    await chrome.storage.local.remove(['capturedImage', 'originalCaptures']);
    await chrome.storage.local.set({
      capturedImage: dataUrl,
      originalCaptures: [{ dataUrl, y: 0 }],
      pageTitle: tab.title || 'Screenshot',
      pageUrl: tab.url || ''
    });

    chrome.tabs.create({ url: 'preview.html' });
  } catch (err) {
    console.error('Capture visible failed:', err);
  }
}

async function handleCaptureFullPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    const tabId = tab.id;

    // 1. Inject Content Script
    await ensureContentScript(tabId);

    // 2. Prepare (Hide Fixed Elements)
    await chrome.tabs.sendMessage(tabId, { type: 'PREPARE_CAPTURE' });

    // 3. Get Page Info
    const info = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_INFO' });
    let { fullHeight, clientHeight, devicePixelRatio, originalScrollY, width } = info;

    // Initial Max calculations
    // Limit: 15 screens (increased count due to overlap strategy reducing effectively covered area per shot)
    const maxScroll = Math.min(fullHeight, clientHeight * 15);
    const OVERLAP = 80; // 80px overlap to ensure no seams and robust header handling

    const captures = [];
    let y = 0;
    let screenCount = 0;

    // 4. Scroll & Capture Loop
    while (y < maxScroll) {
      // Scroll to Y
      const scrollRes = await chrome.tabs.sendMessage(tabId, { type: 'SCROLL_TO', y });

      // Update dimensions in case of lazy loading / infinite scroll expanison
      // Note: maxScroll is now a hard limit, so we don't expand it based on newScrollHeight.
      // However, newScrollHeight is still useful for determining if we've hit the actual bottom.

      const realY = scrollRes.currentScrollY;

      // Wait for rendering (extra safety)
      await new Promise(r => setTimeout(r, 350));

      // Capture
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
      captures.push({ dataUrl, y: realY });
      screenCount++;

      // Stop if we clearly reached the bottom (ignoring precision errors)
      if (realY + clientHeight >= scrollRes.newScrollHeight) { // Use newScrollHeight here to detect actual page bottom
        break;
      }

      // Infinite Scroll Safety Guard
      if (screenCount >= 20) { // Safety limit increased
        console.warn("Reached screen limit.");
        break;
      }

      // Detect stuck (scrolling didn't move us)
      if (captures.length > 1 && captures[captures.length - 1].y === captures[captures.length - 2].y) {
        break;
      }

      // Increment by viewport - overlap
      y += (clientHeight - OVERLAP);

      // Clamp for last screen
      if (y > maxScroll - clientHeight) {
        y = maxScroll - clientHeight;
        if (y < 0) y = 0;

        // If our next target `y` is <= the `realY` we *just* captured, we are done.
        // Or if it is very close (within overlap range), we might be done, but let's capture strict last frame.
        if (y <= realY) break;
      }
    }

    // 5. Restore
    await chrome.tabs.sendMessage(tabId, { type: 'FINISH_CAPTURE', originalScrollY });

    // 6. Stitch
    await setupOffscreenDocument('offscreen.html');

    // Send to offscreen
    // Calculate total height: The bottom of the last image determines the total height.
    const lastCapture = captures[captures.length - 1];
    const finalHeight = lastCapture.y + clientHeight;

    const StitchResponse = await chrome.runtime.sendMessage({
      type: 'STITCH_IMAGES',
      images: captures,
      viewportWidth: width,
      viewportHeight: clientHeight,
      totalHeight: finalHeight,
      devicePixelRatio: devicePixelRatio
    });

    if (StitchResponse && StitchResponse.dataUrl) {
      // Clear old data first
      await chrome.storage.local.remove(['capturedImage', 'originalCaptures']);
      // Store new data
      await chrome.storage.local.set({
        capturedImage: StitchResponse.dataUrl,
        originalCaptures: captures,
        pageTitle: tab.title || 'Screenshot',
        pageUrl: tab.url || ''
      });

      chrome.tabs.create({ url: 'preview.html' });
    } else {
      console.error("Stitching failed");
    }

  } catch (err) {
    console.error('Capture full page failed:', err);
  }
}
