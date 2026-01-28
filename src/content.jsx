// Content script to handle scrolling and page info
// Listen for messages from background script

if (!window.hasCapturelyListener) {
    window.hasCapturelyListener = true;

    let styleElement = null;
    let hiddenElements = new Map();
    let blurredElements = new Map();

    // Patterns to detect sensitive information
    const SENSITIVE_PATTERNS = {
        // Credit card: 4-4-4-4 or 4-6-5 format
        creditCard: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b|\b\d{4}[\s\-]?\d{6}[\s\-]?\d{5}\b/g,
        // Email: standard email format
        email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        // SSN: XXX-XX-XXXX format
        ssn: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
        // Phone: various formats
        phone: /\b(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
        // API keys and tokens (common patterns)
        apiKey: /\b[A-Za-z0-9_\-]{32,}\b/g
    };

    // Sensitive input types and attributes
    const SENSITIVE_SELECTORS = [
        'input[type="password"]',
        'input[type="email"]',
        'input[autocomplete*="cc-"]', // Credit card inputs
        'input[autocomplete="tel"]',
        'input[autocomplete*="email"]',
        'input[autocomplete*="password"]',
        'input[autocomplete*="current-password"]',
        'input[autocomplete*="new-password"]',
        'input[name*="card"]',
        'input[name*="cvv"]',
        'input[name*="cvc"]',
        'input[name*="ssn"]',
        'input[name*="email"]',
        'input[name*="mail"]',
        'input[name*="password"]',
        'input[name*="passwd"]',
        'input[name*="pwd"]',
        'input[id*="card"]',
        'input[id*="cvv"]',
        'input[id*="cvc"]',
        'input[id*="ssn"]',
        'input[id*="email"]',
        'input[id*="mail"]',
        'input[id*="password"]',
        'input[id*="passwd"]',
        'input[id*="pwd"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="card" i]',
        'input[placeholder*="password" i]',
        'input[aria-label*="email" i]',
        'input[aria-label*="card" i]',
        'input[aria-label*="password" i]',
        '[data-sensitive]',
        '.credit-card',
        '.ssn',
        '.api-key'
    ];

    // Helper to detect and blur sensitive elements
    const blurSensitiveContent = () => {
        // Clear previous blurs
        for (const [node, original] of blurredElements) {
            node.style.filter = original.filter;
            node.style.userSelect = original.userSelect;
            node.style.color = original.color;
        }
        blurredElements.clear();

        // 1. Blur sensitive input fields
        SENSITIVE_SELECTORS.forEach(selector => {
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element && element.offsetParent !== null) { // Only visible elements
                        blurredElements.set(element, {
                            filter: element.style.filter || '',
                            userSelect: element.style.userSelect || '',
                            color: element.style.color || ''
                        });
                        element.style.setProperty('filter', 'blur(10px)', 'important');
                        element.style.setProperty('user-select', 'none', 'important');
                        element.style.setProperty('color', 'transparent', 'important');
                        element.style.setProperty('text-shadow', '0 0 8px rgba(0,0,0,0.5)', 'important');
                    }
                });
            } catch (e) {
                console.warn('Error blurring selector:', selector, e);
            }
        });

        // 2. Check all input fields for sensitive content in their values
        const allInputs = document.querySelectorAll('input[type="text"], input:not([type]), input[type="tel"]');
        allInputs.forEach(input => {
            if (!input.value || input.offsetParent === null) return;
            
            const value = input.value;
            let isSensitive = false;

            // Check if value contains email
            if (SENSITIVE_PATTERNS.email.test(value)) {
                isSensitive = true;
            }
            // Check if value contains credit card
            if (SENSITIVE_PATTERNS.creditCard.test(value)) {
                isSensitive = true;
            }
            // Check if value contains phone
            if (SENSITIVE_PATTERNS.phone.test(value)) {
                isSensitive = true;
            }
            // Check if value contains SSN
            if (SENSITIVE_PATTERNS.ssn.test(value)) {
                isSensitive = true;
            }

            if (isSensitive && !blurredElements.has(input)) {
                blurredElements.set(input, {
                    filter: input.style.filter || '',
                    userSelect: input.style.userSelect || '',
                    color: input.style.color || ''
                });
                input.style.setProperty('filter', 'blur(10px)', 'important');
                input.style.setProperty('user-select', 'none', 'important');
                input.style.setProperty('color', 'transparent', 'important');
                input.style.setProperty('text-shadow', '0 0 8px rgba(0,0,0,0.5)', 'important');
            }
        });

        // 3. Scan text nodes for sensitive patterns
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // Skip scripts, styles, and hidden elements
                    if (!node.parentElement) return NodeFilter.FILTER_REJECT;
                    const parent = node.parentElement;
                    const style = window.getComputedStyle(parent);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        let textNode;
        const nodesToBlur = new Set();

        while ((textNode = walker.nextNode())) {
            const text = textNode.textContent;
            
            // Check for sensitive patterns
            for (const [patternName, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
                if (pattern.test(text)) {
                    // Blur the parent element
                    let parent = textNode.parentElement;
                    
                    // Find the closest meaningful parent (not span/inline)
                    while (parent && ['SPAN', 'A', 'STRONG', 'EM', 'B', 'I'].includes(parent.tagName)) {
                        parent = parent.parentElement;
                    }
                    
                    if (parent && !nodesToBlur.has(parent)) {
                        nodesToBlur.add(parent);
                    }
                    break; // Found one pattern, no need to check others
                }
            }
        }

        // Apply blur to detected text nodes' parents
        nodesToBlur.forEach(element => {
            blurredElements.set(element, {
                filter: element.style.filter || '',
                userSelect: element.style.userSelect || '',
                color: element.style.color || ''
            });
            element.style.setProperty('filter', 'blur(8px)', 'important');
            element.style.setProperty('user-select', 'none', 'important');
        });

        console.log(`Capturely: Blurred ${blurredElements.size} sensitive elements`);
    };

    // Helper to remove blur from sensitive content
    const unblurSensitiveContent = () => {
        for (const [node, original] of blurredElements) {
            node.style.filter = original.filter;
            node.style.userSelect = original.userSelect;
            if (original.color !== undefined) {
                node.style.color = original.color;
            }
            if (original.textShadow !== undefined) {
                node.style.textShadow = original.textShadow;
            }
        }
        blurredElements.clear();
    };

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

            // Only hide elements that are sticky/fixed at the TOP or BOTTOM
            // Do NOT hide sticky columns (left/right)
            const rect = node.getBoundingClientRect();
            const isTopOrBottom = (
                (style.top !== 'auto' && style.top !== '' && parseFloat(style.top) < 100) || // Sticky/fixed to top
                (style.bottom !== 'auto' && style.bottom !== '' && parseFloat(style.bottom) < 100) // Sticky/fixed to bottom
            );

            // Skip left/right sticky elements (like sticky table columns)
            if (!isTopOrBottom) {
                continue;
            }

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
            blurSensitiveContent(); // Blur sensitive data before capture
            sendResponse({ success: true });
        } else if (request.type === 'FINISH_CAPTURE') {
            restorePage();
            unblurSensitiveContent(); // Remove blur after capture
            if (request.originalScrollY !== undefined) {
                window.scrollTo({ top: request.originalScrollY, behavior: 'auto' });
            }
            sendResponse({ success: true });
        }
    });
}