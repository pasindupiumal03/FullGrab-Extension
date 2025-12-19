import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';

const ImageEditor = ({ imageSrc, onSave, onCancel }) => {
    const canvasRef = useRef(null);
    const [canvas, setCanvas] = useState(null);
    const [activeTool, setActiveTool] = useState(null); // 'shapes', 'crop', 'background', 'mockup'
    const [activeObject, setActiveObject] = useState(null);
    const [cropObj, setCropObj] = useState(null);
    const [mainImage, setMainImage] = useState(null);
    const [screenshotImage, setScreenshotImage] = useState(null); // Reference to raw image
    const [bgPadding, setBgPadding] = useState(40);
    const [bgColor, setBgColor] = useState('#f3f4f6');
    const [bgImage, setBgImage] = useState(null);
    const [hasOutline, setHasOutline] = useState(false);
    const [outlineColor, setOutlineColor] = useState('#000000');

    // Properties State
    const [color, setColor] = useState('#ff0000');
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [radius, setRadius] = useState(0);

    // Initialize Canvas
    useEffect(() => {
        if (!canvasRef.current) return;

        const initCanvas = new fabric.Canvas(canvasRef.current, {
            height: window.innerHeight - 100,
            width: window.innerWidth - 350, // Sidebar (250) + RightPanel (300) ?? Let's adjust
            backgroundColor: '#f3f4f6',
            selection: true,
            preserveObjectStacking: true // Important so background doesn't cover
        });

        const imgObj = new Image();
        imgObj.src = imageSrc;
        imgObj.onload = () => {
            const img = new fabric.Image(imgObj);
            // Scale logic
            // const maxW = initCanvas.width * 0.9; // fabric v6 might use getWidth()
            const maxW = initCanvas.getWidth() - (bgPadding * 2); // Initial padding
            const maxH = initCanvas.getHeight() - (bgPadding * 2);

            // Check if fabric.util.findScaleToFit exists or do manual
            const scale = Math.min(maxW / imgObj.width, maxH / imgObj.height, 1);

            img.scale(scale);
            initCanvas.centerObject(img);
            initCanvas.add(img);
            initCanvas.setActiveObject(img);
            setMainImage(img); // Store reference
            setScreenshotImage(img); // Store reference to the original image object
            initCanvas.renderAll();
        };

        // Event Listeners
        initCanvas.on('selection:created', (e) => updateProperties(e.selected[0]));
        initCanvas.on('selection:updated', (e) => updateProperties(e.selected[0]));
        initCanvas.on('selection:cleared', () => setActiveObject(null));

        // Drag and Drop (Native listeners on wrapper, or fabric D&D?)
        // Applying to wrapper div in render

        setCanvas(initCanvas);

        return () => {
            initCanvas.dispose();
        }
    }, [imageSrc]);

    const updateProperties = (obj) => {
        if (!obj) return;
        setActiveObject(obj);
        setColor(obj.stroke || obj.fill || '#000000');
        setStrokeWidth(obj.strokeWidth || 0);
        if (obj.type === 'rect') setRadius(obj.rx || 0);
    };

    // --- Tool Actions ---
    const addShape = (type) => {
        if (!canvas) return;
        let shape;
        const center = canvas.getCenter();
        const commonProps = {
            left: center.left,
            top: center.top,
            stroke: color,
            strokeWidth: strokeWidth,
            fill: 'transparent',
            originX: 'center',
            originY: 'center'
        };

        if (type === 'rect') {
            shape = new fabric.Rect({ ...commonProps, width: 100, height: 100, rx: radius, ry: radius });
        } else if (type === 'circle') {
            shape = new fabric.Circle({ ...commonProps, radius: 50 });
        } else if (type === 'line') {
            shape = new fabric.Line([50, 50, 200, 50], { ...commonProps });
        } else if (type === 'arrow') {
            // Simple arrow logic (Group of Line + Triangle)
            // For now just a triangle path or similar
            const triangle = new fabric.Triangle({ width: 20, height: 20, fill: color, left: 200, top: 50, angle: 90 });
            const line = new fabric.Line([50, 50, 200, 50], { stroke: color, strokeWidth: strokeWidth });
            shape = new fabric.Group([line, triangle], { ...commonProps });
        } else if (type === 'text') {
            shape = new fabric.IText('Text', { ...commonProps, fill: color, stroke: null, fontSize: 40 });
        }

        if (shape) {
            canvas.add(shape);
            canvas.setActiveObject(shape);
            canvas.renderAll();
        }
    };

    // --- Property Updates ---
    const handleColorChange = (e) => {
        const val = e.target.value;
        setColor(val);
        if (activeObject) {
            if (activeObject.type === 'i-text') activeObject.set('fill', val);
            else {
                activeObject.set('stroke', val);
                // Also update fill if it was arrow triangle? Complex. 
                // Simple assumption: Shapes are outlined.
            }
            canvas.renderAll();
        }
    };

    const addSticker = (emoji) => {
        if (!canvas) return;
        const center = canvas.getCenter();
        const text = new fabric.IText(emoji, {
            left: center.left,
            top: center.top,
            fontSize: 80,
            originX: 'center',
            originY: 'center',
            selectable: true
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        canvas.renderAll();
    };

    const activateCrop = () => {
        if (!canvas) return;
        const center = canvas.getCenter();
        const rect = new fabric.Rect({
            left: center.left,
            top: center.top,
            width: canvas.getWidth() * 0.5,
            height: canvas.getHeight() * 0.5,
            fill: 'rgba(0,0,0,0)',
            stroke: '#000', // Changed to black
            strokeWidth: 2,
            strokeDashArray: [10, 5],
            originX: 'center',
            originY: 'center',
            transparentCorners: false,
            cornerColor: 'black', // Changed to black
            cornerStrokeColor: 'white', // For constrast
            borderColor: 'black', // Changed to black
            cornerSize: 12,
            padding: 10
        });

        canvas.add(rect);
        canvas.setActiveObject(rect);
        setCropObj(rect);
        setActiveTool('crop');
    };

    const performCrop = () => {
        if (!canvas || !cropObj) return;

        cropObj.visible = false;
        canvas.renderAll();

        const scaledWidth = cropObj.getScaledWidth();
        const scaledHeight = cropObj.getScaledHeight();
        const left = cropObj.left - (scaledWidth / 2);
        const top = cropObj.top - (scaledHeight / 2);

        const dataUrl = canvas.toDataURL({
            left: left,
            top: top,
            width: scaledWidth,
            height: scaledHeight,
            format: 'png',
            multiplier: 2
        });

        canvas.clear();
        setCropObj(null);
        setActiveTool(null);

        const imgObj = new Image();
        imgObj.src = dataUrl;
        imgObj.onload = () => {
            const img = new fabric.Image(imgObj);
            const maxW = canvas.getWidth() * 0.9;
            const maxH = canvas.getHeight() * 0.9;
            const scale = Math.min(maxW / imgObj.width, maxH / imgObj.height, 1);
            img.scale(scale);
            canvas.centerObject(img);
            canvas.add(img);
            canvas.setActiveObject(img);
            setMainImage(img);
            setScreenshotImage(img); // Update screenshot reference
            canvas.renderAll();
        };
    };

    const cancelCrop = () => {
        if (!canvas || !cropObj) return;
        canvas.remove(cropObj);
        setCropObj(null);
        setActiveTool(null);
        canvas.renderAll();
    };

    const applyMockup = (type) => {
        if (!canvas || !screenshotImage) return;

        // Cleanup current main image
        if (mainImage) {
            canvas.remove(mainImage);
        }

        const fitToCanvas = (obj) => {
            const maxW = canvas.getWidth() - (bgPadding * 2);
            const maxH = canvas.getHeight() - (bgPadding * 2);
            const scale = Math.min(maxW / obj.width, maxH / obj.height, 1);
            obj.scale(scale);
            canvas.centerObject(obj);
            canvas.setActiveObject(obj);
            canvas.renderAll();
        };

        if (type === 'none') {
            // Restore Original
            screenshotImage.set({
                scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                left: 0, top: 0, originX: 'center', originY: 'center'
            });
            canvas.add(screenshotImage);
            setMainImage(screenshotImage);
            fitToCanvas(screenshotImage);
            return;
        }

        // Create Mockup using a clone to avoid messing up the original
        screenshotImage.clone().then((clonedImg) => {
            // Reset standard props on clone
            clonedImg.set({
                scaleX: 1, scaleY: 1, angle: 0, opacity: 1,
                left: 0, top: 0, originX: 'center', originY: 'center'
            });

            let finalObject;
            const w = clonedImg.width;
            const h = clonedImg.height;
            const headerHeight = 40;

            if (type === 'macos') {
                const header = new fabric.Rect({
                    width: w, height: headerHeight,
                    fill: '#f1f1f1',
                    originX: 'center', originY: 'bottom',
                    top: -h / 2,
                    rx: 10, ry: 10
                });

                const headerPatch = new fabric.Rect({
                    width: w, height: 20,
                    fill: '#f1f1f1',
                    originX: 'center', originY: 'top',
                    top: -h / 2
                });

                const dots = new fabric.Group([
                    new fabric.Circle({ radius: 6, fill: '#ff5f56', left: -w / 2 + 20, top: -h / 2 + 20, originY: 'center' }),
                    new fabric.Circle({ radius: 6, fill: '#ffbd2e', left: -w / 2 + 45, top: -h / 2 + 20, originY: 'center' }),
                    new fabric.Circle({ radius: 6, fill: '#27c93f', left: -w / 2 + 70, top: -h / 2 + 20, originY: 'center' })
                ]);

                clonedImg.set({
                    originX: 'center', originY: 'top',
                    top: -h / 2
                });

                finalObject = new fabric.Group([header, headerPatch, dots, clonedImg], {
                    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.3)', blur: 30, offsetY: 20 })
                });

            } else if (type === 'windows') {
                const header = new fabric.Rect({
                    width: w, height: headerHeight,
                    fill: '#ffffff',
                    stroke: '#e5e5e5', strokeWidth: 1,
                    originX: 'center', originY: 'bottom',
                    top: -h / 2
                });

                clonedImg.set({
                    originX: 'center', originY: 'top',
                    top: -h / 2
                });

                const controls = new fabric.IText('—  □  ✕', {
                    fontSize: 16, fill: '#666',
                    originX: 'right', originY: 'center',
                    left: w / 2 - 20, top: -h / 2 - 20,
                    fontFamily: 'sans-serif',
                    selectable: false
                });

                const border = new fabric.Rect({
                    width: w, height: h + headerHeight,
                    fill: 'transparent',
                    stroke: '#e5e5e5', strokeWidth: 1,
                    originX: 'center', originY: 'center'
                });

                finalObject = new fabric.Group([header, clonedImg, controls, border], {
                    shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.2)', blur: 25, offsetY: 15 })
                });
            }

            canvas.add(finalObject);
            setMainImage(finalObject);
            fitToCanvas(finalObject);
        });
    };

    // Background Functions
    const handleBgColorUpdate = (color) => {
        setBgColor(color);
        if (canvas) {
            canvas.backgroundColor = color;
            canvas.setBackgroundImage(null, canvas.renderAll.bind(canvas)); // Clear image if color set
            setBgImage(null);
            canvas.renderAll();
        }
    };

    const applyBgImage = (url) => {
        if (!canvas) return;
        fabric.Image.fromURL(url, (img) => {
            // Fit background
            const canvasAspect = canvas.getWidth() / canvas.getHeight();
            const imgAspect = img.width / img.height;

            let scaleFactor;
            if (canvasAspect >= imgAspect) {
                scaleFactor = canvas.getWidth() / img.width;
            } else {
                scaleFactor = canvas.getHeight() / img.height;
            }

            canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
                scaleX: scaleFactor,
                scaleY: scaleFactor,
                originX: 'left',
                originY: 'top',
                crossOrigin: 'anonymous' // Important for images from external sources
            });
            setBgImage(url);
            canvas.backgroundColor = ''; // Clear background color if image is set
        });
    };

    const handlePaddingUpdate = (val) => {
        setBgPadding(val);
        if (canvas && mainImage) {
            const maxW = canvas.getWidth() - (val * 2);
            const maxH = canvas.getHeight() - (val * 2);
            // We need to use original image dimensions to avoid cumulative scaling errors?
            // fabric object maintains .width/.height as original. .scaleX/.scaleY changes.
            const scale = Math.min(maxW / mainImage.width, maxH / mainImage.height, 1); // Limit scaling to 1?? Or allow zoom?
            // If user wants lots of padding, image gets small.
            mainImage.scale(scale);
            canvas.centerObject(mainImage);
            canvas.renderAll();
        }
    };

    const handleOutlineUpdate = (active) => {
        setHasOutline(active);
        if (mainImage) {
            mainImage.set('stroke', active ? outlineColor : null);
            mainImage.set('strokeWidth', active ? 5 : 0);
            canvas.renderAll();
        }
    };

    const handleOutlineColorUpdate = (color) => {
        setOutlineColor(color);
        if (mainImage && hasOutline) {
            mainImage.set('stroke', color);
            canvas.renderAll();
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (activeTool !== 'background') return;

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            const reader = new FileReader();
            reader.onload = (f) => {
                applyBgImage(f.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Render Helpers ---
    const renderSidebar = () => (
        <div style={styles.sidebar}>
            <div style={styles.sidebarHeader}>Tools</div>

            {/* Shapes */}
            <div style={styles.toolItem}>
                <button style={styles.toolHeader} onClick={() => setActiveTool(activeTool === 'shapes' ? null : 'shapes')}>
                    01. Shapes {activeTool === 'shapes' ? '▲' : '▼'}
                </button>
                {activeTool === 'shapes' && (
                    <div style={styles.toolContent}>
                        <button style={styles.shapeBtn} onClick={() => addShape('rect')}>Rectangle</button>
                        <button style={styles.shapeBtn} onClick={() => addShape('circle')}>Oval</button>
                        <button style={styles.shapeBtn} onClick={() => addShape('line')}>Line</button>
                        <button style={styles.shapeBtn} onClick={() => addShape('arrow')}>Arrow</button>
                        <button style={styles.shapeBtn} onClick={() => addShape('text')}>Text</button>

                        <div style={{ width: '100%', borderTop: '1px solid #eee', marginTop: '10px', paddingTop: '10px' }}>
                            <small style={{ display: 'block', marginBottom: '5px', fontWeight: 600 }}>Stickers</small>
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                {['😀', '😎', '🔥', '❤️', '✅', '❌', '⭐', '🎉', '👀', '💡'].map(emoji => (
                                    <button key={emoji} style={{ ...styles.shapeBtn, fontSize: '20px', padding: '5px' }} onClick={() => addSticker(emoji)}>
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Crop */}
            <div style={styles.toolItem}>
                <button style={styles.toolHeader} onClick={() => {
                    if (activeTool === 'crop') cancelCrop();
                    else activateCrop();
                }}>
                    02. Crop Screenshot {activeTool === 'crop' ? '▲' : '▼'}
                </button>
                {activeTool === 'crop' && (
                    <div style={styles.toolContent}>
                        <small style={{ color: '#666' }}>Adjust the box to crop</small>
                    </div>
                )}
            </div>

            {/* Background */}
            <div style={styles.toolItem}>
                <button style={styles.toolHeader} onClick={() => setActiveTool(activeTool === 'background' ? null : 'background')}>
                    03. Add Background {activeTool === 'background' ? '▲' : '▼'}
                </button>
                {activeTool === 'background' && <div style={styles.toolContent}>Background options are in the right panel.</div>}
            </div>

            {/* Mockup */}
            <div style={styles.toolItem}>
                <button style={styles.toolHeader} onClick={() => setActiveTool(activeTool === 'mockup' ? null : 'mockup')}>
                    04. Add Mockup {activeTool === 'mockup' ? '▲' : '▼'}
                </button>
                {activeTool === 'mockup' && (
                    <div style={styles.toolContent}>
                        <button style={styles.shapeBtn} onClick={() => applyMockup('macos')}>Mac OS</button>
                        <button style={styles.shapeBtn} onClick={() => applyMockup('windows')}>Windows</button>
                        <button style={styles.shapeBtn} onClick={() => applyMockup('none')}>None</button>
                    </div>
                )}
            </div>
        </div>
    );

    const renderRightPanel = () => {
        if (activeTool === 'crop') {
            return (
                <div style={styles.rightPanel}>
                    <h4 style={{ marginTop: 0 }}>Crop Options</h4>
                    <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
                        Drag corners to resize the crop area.
                    </p>
                    <button style={{ ...styles.saveBtn, width: '100%', margin: '0 0 10px 0' }} onClick={performCrop}>
                        Done Cropping
                    </button>
                    <button style={{ ...styles.cancelBtn, width: '100%' }} onClick={cancelCrop}>
                        Cancel
                    </button>
                </div>
            )
        }

        if (activeTool === 'background') {
            return (
                <div style={styles.rightPanel}>
                    <h4 style={{ marginTop: 0 }}>Background Options</h4>

                    <div style={styles.propItem}>
                        <label>Background Color</label>
                        <input type="color" value={bgColor} onChange={(e) => handleBgColorUpdate(e.target.value)} style={{ width: '100%', height: '40px', cursor: 'pointer' }} />
                    </div>

                    <div style={styles.propItem}>
                        <label>Padding: {bgPadding}px</label>
                        <input type="range" min="0" max="200" value={bgPadding} onChange={(e) => handlePaddingUpdate(parseInt(e.target.value))} />
                    </div>

                    <div style={{ ...styles.propItem, flexDirection: 'row', alignItems: 'center' }}>
                        <input type="checkbox" checked={hasOutline} onChange={(e) => handleOutlineUpdate(e.target.checked)} id="outlineCheck" />
                        <label htmlFor="outlineCheck" style={{ marginLeft: '8px' }}>Image Outline</label>
                    </div>

                    {hasOutline && (
                        <div style={styles.propItem}>
                            <label>Outline Color</label>
                            <input type="color" value={outlineColor} onChange={(e) => handleOutlineColorUpdate(e.target.value)} style={{ width: '100%', height: '40px' }} />
                        </div>
                    )}

                    <div style={{ ...styles.propItem, borderTop: '1px solid #eee', paddingTop: '15px' }}>
                        <label style={{ marginBottom: '5px', display: 'block' }}>Background Image</label>
                        <div style={{
                            border: '2px dashed #ccc',
                            padding: '20px',
                            textAlign: 'center',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            color: '#666'
                        }}
                            onClick={() => document.getElementById('bgInput').click()}
                        >
                            Select or Drop Image
                        </div>
                        <input
                            type="file"
                            id="bgInput"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                if (e.target.files[0]) {
                                    const reader = new FileReader();
                                    reader.onload = (f) => applyBgImage(f.target.result);
                                    reader.readAsDataURL(e.target.files[0]);
                                }
                            }}
                        />
                    </div>
                </div>
            );
        }

        if (!activeObject) return <div style={styles.rightPanel}><p>Select an object to edit</p></div>;
        return (
            <div style={styles.rightPanel}>
                <div style={styles.propItem}>
                    <label>Color</label>
                    <input type="color" value={color} onChange={handleColorChange} />
                </div>
                {activeObject.type !== 'i-text' && (
                    <div style={styles.propItem}>
                        <label>Stroke Width: {strokeWidth}</label>
                        <input type="range" min="1" max="20" value={strokeWidth} onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setStrokeWidth(val);
                            activeObject.set('strokeWidth', val);
                            canvas.renderAll();
                        }} />
                    </div>
                )}
                {/* Specifics for Rect */}
                {activeObject.type === 'rect' && (
                    <div style={styles.propItem}>
                        <label>Radius: {radius}</label>
                        <input type="range" min="0" max="50" value={radius} onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setRadius(val);
                            activeObject.set({ rx: val, ry: val });
                            canvas.renderAll();
                        }} />
                    </div>
                )}
            </div>
        )
    };

    const [zoom, setZoom] = useState(100);

    const handleZoom = (step) => {
        if (!canvas) return;
        let newZoom = zoom + step;
        if (newZoom < 10) newZoom = 10;
        if (newZoom > 300) newZoom = 300;

        setZoom(newZoom);

        // Zoom to center
        const center = { x: canvas.width / 2, y: canvas.height / 2 };
        canvas.zoomToPoint(center, newZoom / 100);

        // Optional: Panning logic could be added here if needed, but for now we rely on browser scrolling or basic canvas scroll? 
        // Fabric canvas itself doesn't scroll automatically without extra logic if dimensions are fixed.
        // Actually, fabric canvas size is fixed. Objects just get smaller/bigger.
    };

    const handleSave = () => {
        // Export Canvas to DataURL
        const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 }); // High res
        onSave(dataUrl);
    };

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <h3 style={{ margin: 0 }}>Editor</h3>
                <div>
                    <button style={styles.cancelBtn} onClick={onCancel}>Cancel</button>
                    <button style={styles.saveBtn} onClick={handleSave}>Done</button>
                </div>
            </div>

            <div style={styles.workspace}>
                {renderSidebar()}
                <div
                    style={{ ...styles.canvasArea, position: 'relative' }}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                >
                    <canvas ref={canvasRef} />

                    {/* Zoom Controls */}
                    <div style={{
                        position: 'absolute',
                        bottom: '20px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(12px)',
                        borderRadius: '100px',
                        padding: '6px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                        border: '1px solid rgba(255,255,255,0.4)',
                        zIndex: 10
                    }}>
                        <button onClick={() => handleZoom(-10)} style={styles.zoomBtn} title="Zoom Out">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>

                        <span style={{
                            fontFamily: 'Inter, system-ui, sans-serif',
                            fontWeight: 600,
                            fontSize: '14px',
                            color: '#333',
                            minWidth: '45px',
                            textAlign: 'center',
                            userSelect: 'none'
                        }}>
                            {zoom}%
                        </span>

                        <button onClick={() => handleZoom(10)} style={styles.zoomBtn} title="Zoom In">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                    </div>
                </div>
                {renderRightPanel()}
            </div>
        </div>
    );
};

const styles = {
    container: {
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        backgroundColor: '#fff', zIndex: 200, display: 'flex', flexDirection: 'column'
    },
    header: {
        height: '60px', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #e5e7eb', background: 'white'
    },
    workspace: {
        flex: 1, display: 'flex', overflow: 'hidden'
    },
    sidebar: {
        width: '260px', borderRight: '1px solid #e5e7eb', padding: '10px', overflowY: 'auto'
    },
    canvasArea: {
        flex: 1, backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' // Changed auto to hidden since we control zoom on canvas
    },
    rightPanel: {
        width: '260px', borderLeft: '1px solid #e5e7eb', padding: '20px', background: 'white'
    },
    toolItem: {
        marginBottom: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden'
    },
    toolHeader: {
        width: '100%', padding: '10px', background: '#f9fafb', border: 'none', textAlign: 'left', fontWeight: 'bold', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between'
    },
    toolContent: {
        padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px'
    },
    shapeBtn: {
        padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '13px'
    },
    propItem: {
        marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '5px'
    },
    saveBtn: {
        padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginLeft: '10px'
    },
    cancelBtn: {
        padding: '8px 16px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer'
    },
    zoomBtn: {
        background: 'transparent',
        border: 'none',
        padding: '8px',
        borderRadius: '50%',
        cursor: 'pointer',
        color: '#555',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease'
    }
};

export default ImageEditor;
