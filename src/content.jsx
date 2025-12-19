// Content script to handle scrolling and page info
// Listen for messages from background script

if (!window.hasCapturelyListener) {
    window.hasCapturelyListener = true;

    let styleElement = null;
    let hiddenElements = new Map();

    // Helper to hide scrollbars and disable animations
    const preparePage = () => {
        if (styleElement) return;
        styleElement = document.createElement('style');
        styleElement.id = 'capturely-styles';
        styleElement.textContent = `
      ::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        background: transparent !important;
      }
      *::-webkit-scrollbar {
        display: none !important;
        width: 0 !important;
        height: 0 !important;
        background: transparent !important;
      }
      body, html {
        -ms-overflow-style: none !important;
        scrollbar-width: none !important;
      }
      * {
        transition: none !important;
        animation: none !important;
        scroll-behavior: auto !important;
        scrollbar-width: none !important;
      }
    `;
        document.head.appendChild(styleElement);
        collectFixedElements();
    };

    const collectFixedElements = () => {
        // Only collect if not already collected
        if (hiddenElements.size > 0) return;

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: (node) => {
                    const style = window.getComputedStyle(node);
                    if (style.position === 'fixed' || style.position === 'sticky') {
                        return NodeFilter.FILTER_ACCEPT;
                    }
                    return NodeFilter.FILTER_SKIP;
                }
            }
        );

        let node;
        while ((node = walker.nextNode())) {
            const style = window.getComputedStyle(node);
            // Skip hidden inputs or already hidden stuff
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

            // Store original state
            hiddenElements.set(node, {
                visibility: node.style.visibility,
                opacity: node.style.opacity
            });
        }
    };

    const updateFixedElements = (shouldHide) => {
        for (const [node, original] of hiddenElements) {
            if (shouldHide) {
                node.style.setProperty('visibility', 'hidden', 'important');
                node.style.setProperty('opacity', '0', 'important');
            } else {
                node.style.visibility = original.visibility;
                node.style.opacity = original.opacity;
            }
        }
    };

    // Helper to restore page
    const restorePage = () => {
        if (styleElement) {
            styleElement.remove();
            styleElement = null;
        }

        // Restore fixed elements
        for (const [node, original] of hiddenElements) {
            node.style.visibility = original.visibility;
            node.style.opacity = original.opacity;
        }
        hiddenElements.clear();
    };

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'PING') {
            sendResponse({ status: 'ok' });
        } else if (request.type === 'GET_PAGE_INFO') {
            const body = document.body;
            const html = document.documentElement;

            // Standard height calculations
            const standardHeight = Math.max(
                body.scrollHeight, body.offsetHeight,
                html.clientHeight, html.scrollHeight, html.offsetHeight
            );

            // Additional check: Find the bottom-most element to ensure footer is captured
            let maxBottom = standardHeight;

            try {
                // Get all elements and find the one with the highest bottom position
                const allElements = document.querySelectorAll('*');
                for (const element of allElements) {
                    const rect = element.getBoundingClientRect();
                    const elementBottom = rect.bottom + window.scrollY;
                    if (elementBottom > maxBottom) {
                        maxBottom = elementBottom;
                    }
                }
            } catch (e) {
                console.warn('Could not calculate element positions:', e);
            }

            // Use the larger value to ensure we capture everything
            const fullHeight = Math.max(standardHeight, maxBottom);

            sendResponse({
                fullHeight,
                clientHeight: window.innerHeight,
                devicePixelRatio: window.devicePixelRatio,
                originalScrollY: window.scrollY,
                width: window.innerWidth
            });
        } else if (request.type === 'SCROLL_TO') {
            const { y } = request;

            // Handle fixed elements based on scroll position
            // Show at top (y=0), Hide when scrolled (y>0)
            updateFixedElements(y > 0);

            // Force instant scroll
            window.scrollTo({
                top: y,
                behavior: 'instant'
            });

            // Allow time for rendering/loading
            // Increased to 250ms for better stability
            setTimeout(() => {
                sendResponse({ success: true, currentScrollY: window.scrollY, newScrollHeight: document.documentElement.scrollHeight });
            }, 250);
            return true;
        } else if (request.type === 'PREPARE_CAPTURE') {
            preparePage();
            sendResponse({ success: true });
        } else if (request.type === 'FINISH_CAPTURE') {
            restorePage();
            if (request.originalScrollY !== undefined) {
                window.scrollTo({ top: request.originalScrollY, behavior: 'auto' });
            }
            sendResponse({ success: true });
        }
    });
}