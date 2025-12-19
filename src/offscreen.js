
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'STITCH_IMAGES') {
        stitchImages(msg.images, msg.viewportWidth, msg.viewportHeight, msg.totalHeight).then(dataUrl => {
            sendResponse({ dataUrl });
        }).catch(err => {
            console.error('Stitch error', err);
            sendResponse({ error: err.message });
        });
        return true;
    }
});

async function stitchImages(images, viewportWidth, viewportHeight, totalHeight) {
    if (!images || images.length === 0) return null;

    // Sort by Y position just in case
    images.sort((a, b) => a.y - b.y);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Load first image to determine real pixel dimensions
    const firstImage = await loadImage(images[0].dataUrl);

    // Calculate scale factor (Physical Pixels / CSS Pixels)
    const scale = firstImage.width / viewportWidth;

    // Set canvas dimensions
    canvas.width = firstImage.width;
    // Use Math.floor to avoid sub-pixel canvas heights which can cause lines
    canvas.height = Math.floor(totalHeight * scale);

    // Iterate and draw
    for (let i = 0; i < images.length; i++) {
        const imgData = images[i];
        const img = await loadImage(imgData.dataUrl);

        // Calculate Y position in canvas pixels
        // Round to nearest pixel to avoid aliasing artifacts (seams)
        let yPos = Math.round(imgData.y * scale);

        // Draw
        ctx.drawImage(img, 0, yPos);
    }

    return canvas.toDataURL('image/png');
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}
