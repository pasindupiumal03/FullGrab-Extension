// Background script
import { authService } from "./services/authService";
import { entitlementService } from "./services/entitlementService";
import { ENTITLEMENT_CACHE_TTL } from "./constants/config";

chrome.runtime.onInstalled.addListener(async () => {
  console.log("[Background] Extension installed/updated");
  await entitlementService.initTrial();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("[Background] Browser startup");
});

// Ensure offscreen document exists
async function setupOffscreenDocument(path) {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });

  if (existingContexts.length > 0) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: path,
    reasons: ["BLOBS"],
    justification: "Stitching screenshots",
  });
}

// Inject content script if not present
async function ensureContentScript(tabId) {
  const maxRetries = 3;
  const retryDelay = 300;

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Try to ping the content script
      await chrome.tabs.sendMessage(tabId, { type: "PING" });
      console.log("Content script is ready on tab", tabId);
      return; // Success - script is ready
    } catch (err) {
      console.log(
        `Ping attempt ${i + 1}/${maxRetries} failed for tab ${tabId}`
      );

      // On first failure, inject the script
      if (i === 0) {
        console.log("Injecting content script into tab", tabId);
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ["content.js"],
          });
        } catch (injectErr) {
          console.error("Failed to inject content script:", injectErr);
          throw injectErr;
        }
      }

      // Wait before retrying (except on last attempt)
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, retryDelay));
      }
    }
  }

  // If we get here, all retries failed
  throw new Error("Content script failed to respond after multiple attempts");
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      if (!request || !request.type) return;

      console.log(`[Background] Received message: ${request.type}`);

      switch (request.type) {
        case "CAPTURE_VISIBLE":
          await handleCaptureVisible();
          sendResponse({ ok: true });
          break;

        case "CAPTURE_FULL_PAGE":
          await handleCaptureFullPage();
          sendResponse({ ok: true });
          break;

        case "PAYMENT_SUCCESS":
          await entitlementService.refresh();
          sendResponse({ ok: true });
          break;

        case "INITIATE_LOGIN":
          await authService.initiateLogin();
          sendResponse({ ok: true });
          break;

        case "INITIATE_UPGRADE":
          await authService.initiateUpgrade();
          sendResponse({ ok: true });
          break;

        case "REFRESH_TOKEN":
          const refreshSuccess = await authService.performRefresh();
          sendResponse({ ok: true, success: refreshSuccess });
          break;

        case "PING":
          sendResponse({ ok: true });
          break;

        default:
          console.warn(`[Background] Unknown message type: ${request.type}`);
          sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (err) {
      console.error(
        `[Background] Error handling message ${request?.type}:`,
        err
      );
      sendResponse({ ok: false, error: err.message });
    }
  })();

  return true; // Keep channel open for async response
});

async function handleCaptureVisible() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;

    // Inject content script
    await ensureContentScript(tab.id);

    // Apply sensitive content blur
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "PREPARE_CAPTURE" });
    } catch (e) {
      console.warn("Could not blur sensitive content:", e);
    }

    // Wait a moment for blur to apply
    await new Promise((r) => setTimeout(r, 100));

    // CSS to hide scrollbars - More aggressive
    const css = `
      html, body {
        overflow: hidden !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      html::-webkit-scrollbar, body::-webkit-scrollbar, ::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
        background: transparent !important;
      }
    `;

    // Inject CSS
    await chrome.scripting
      .insertCSS({
        target: { tabId: tab.id },
        css: css,
      })
      .catch((err) => console.warn("Failed to inject CSS:", err));

    // Tiny safety buffer (50ms) to ensure the render engine applies the 'overflow: hidden'
    // This is practically instant for the user but fixes the race condition.
    await new Promise((r) => setTimeout(r, 50));

    // Capture
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: "png",
    });

    // Remove CSS
    await chrome.scripting
      .removeCSS({
        target: { tabId: tab.id },
        css: css,
      })
      .catch((err) => console.warn("Failed to remove CSS:", err));

    // Remove blur
    try {
      await chrome.tabs.sendMessage(tab.id, { type: "FINISH_CAPTURE" });
    } catch (e) {
      console.warn("Could not remove blur:", e);
    }

    // Clear storage first to avoid quota issues with old data
    await chrome.storage.local.remove(["capturedImage", "originalCaptures"]);
    await chrome.storage.local.set({
      capturedImage: dataUrl,
      originalCaptures: [{ dataUrl, y: 0 }],
      pageTitle: tab.title || "Screenshot",
      pageUrl: tab.url || "",
    });

    chrome.tabs.create({ url: "preview.html" });
  } catch (err) {
    console.error("Capture visible failed:", err);
  }
}

async function handleCaptureFullPage() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab) return;
    const tabId = tab.id;

    // 1. Inject Content Script
    await ensureContentScript(tabId);

    // 2. Prepare (Hide Fixed Elements)
    await chrome.tabs.sendMessage(tabId, { type: "PREPARE_CAPTURE" });

    // 3. Get Page Info
    const info = await chrome.tabs.sendMessage(tabId, {
      type: "GET_PAGE_INFO",
    });
    let { fullHeight, clientHeight, devicePixelRatio, originalScrollY, width } =
      info;

    // Initial Max calculations
    // Limit: 30 screens (increased count due to overlap strategy reducing effectively covered area per shot)
    const maxScroll = Math.min(fullHeight, clientHeight * 30);
    const OVERLAP = 80; // 80px overlap to ensure no seams and robust header handling

    const captures = [];
    let y = 0;
    let screenCount = 0;

    // 4. Scroll & Capture Loop
    while (y < maxScroll) {
      // Scroll to Y
      const scrollRes = await chrome.tabs.sendMessage(tabId, {
        type: "SCROLL_TO",
        y,
      });

      // Update dimensions in case of lazy loading / infinite scroll expanison
      // Note: maxScroll is now a hard limit, so we don't expand it based on newScrollHeight.
      // However, newScrollHeight is still useful for determining if we've hit the actual bottom.

      const realY = scrollRes.currentScrollY;

      // Wait for rendering and lazy-loaded images
      await new Promise((r) => setTimeout(r, 500));

      // Capture
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
      });
      captures.push({ dataUrl, y: realY });
      screenCount++;

      // Stop if we clearly reached the bottom (ignoring precision errors)
      if (realY + clientHeight >= scrollRes.newScrollHeight) {
        // Use newScrollHeight here to detect actual page bottom
        break;
      }

      // Infinite Scroll Safety Guard
      if (screenCount >= 30) {
        // Safety limit increased to 30
        console.warn("Reached screen limit.");
        break;
      }

      // Detect stuck (scrolling didn't move us)
      if (
        captures.length > 1 &&
        captures[captures.length - 1].y === captures[captures.length - 2].y
      ) {
        break;
      }

      // Increment by viewport - overlap
      y += clientHeight - OVERLAP;

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
    await chrome.tabs.sendMessage(tabId, {
      type: "FINISH_CAPTURE",
      originalScrollY,
    });

    // 6. Stitch
    await setupOffscreenDocument("offscreen.html");

    // Send to offscreen
    // Calculate total height: The bottom of the last image determines the total height.
    const lastCapture = captures[captures.length - 1];
    const finalHeight = lastCapture.y + clientHeight;

    const StitchResponse = await chrome.runtime.sendMessage({
      type: "STITCH_IMAGES",
      images: captures,
      viewportWidth: width,
      viewportHeight: clientHeight,
      totalHeight: finalHeight,
      devicePixelRatio: devicePixelRatio,
    });

    if (StitchResponse && StitchResponse.dataUrl) {
      // Clear old data first
      await chrome.storage.local.remove(["capturedImage", "originalCaptures"]);
      // Store new data
      await chrome.storage.local.set({
        capturedImage: StitchResponse.dataUrl,
        originalCaptures: captures,
        pageTitle: tab.title || "Screenshot",
        pageUrl: tab.url || "",
      });

      chrome.tabs.create({ url: "preview.html" });
    } else {
      console.error("Stitching failed");
    }
  } catch (err) {
    console.error("Capture full page failed:", err);
  }
}
