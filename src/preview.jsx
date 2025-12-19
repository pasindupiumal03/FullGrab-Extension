import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from "jspdf";

import ImageEditor from './components/ImageEditor';

const Preview = () => {
    const [image, setImage] = useState(null);
    const [captures, setCaptures] = useState([]);
    const [zoom, setZoom] = useState(50);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleted, setIsDeleted] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [sharedLink, setSharedLink] = useState(null);

    const handleShare = async () => {
        setIsSharing(true);
        try {
            // image is likely "data:image/png;base64,....."
            const base64Image = image.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

            const formData = new FormData();
            formData.append("key", "53fce98db6e1008f5c0ec630f5572936");
            formData.append("image", base64Image);

            const response = await fetch("https://api.imgbb.com/1/upload", {
                method: "POST",
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                // Save the link to state instead of opening
                setSharedLink(result.data.url_viewer);
            } else {
                alert("Failed to upload image: " + (result.status_txt || "Unknown error"));
            }
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Upload failed. Please check your connection.");
        } finally {
            setIsSharing(false);
        }
    };

    useEffect(() => {
        console.log("Preview mounted. Fetching from storage...");
        try {
            chrome.storage.local.get(['capturedImage', 'originalCaptures'], (result) => {
                const error = chrome.runtime.lastError;
                if (error) {
                    console.error("Storage error:", error);
                    return;
                }

                console.log("Storage result:", result);
                if (result && result.capturedImage) {
                    console.log("Found captured image in storage.");
                    setImage(result.capturedImage);
                } else {
                    console.warn("No capturedImage found.");
                }

                if (result && result.originalCaptures) {
                    setCaptures(result.originalCaptures);
                }
            });
        } catch (e) {
            console.error("Error accessing chrome.storage:", e);
        }
    }, []);

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 10));

    const handleDownloadPNG = () => {
        const link = document.createElement('a');
        link.href = image;
        link.download = 'screenshot.png';
        link.click();
    };

    const handleDownloadPDF = () => {
        if (!captures || captures.length === 0) {
            // Fallback if no captures array (e.g. visible tab only old data)
            const pdf = new jsPDF();
            const imgProps = pdf.getImageProperties(image);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            pdf.addImage(image, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('screenshot.pdf');
            return;
        }

        // Multi-page PDF
        // Create PDF with orientation based on first image
        const firstCap = captures[0];
        const isLandscape = firstCap.width > firstCap.height;

        const pdf = new jsPDF({
            orientation: isLandscape ? 'l' : 'p',
            unit: 'px',
            format: 'a4' // Standard format, will fit images to it
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        captures.forEach((cap, index) => {
            if (index > 0) pdf.addPage();

            const imgData = cap.dataUrl;

            // Calculate dimensions to fit/fill page
            // We want to fit within margins maybe? Or full page? 
            // Let's do fit to width, standard PDF behavior

            const imgProps = pdf.getImageProperties(imgData);
            const ratio = imgProps.width / imgProps.height;

            let w = pageWidth;
            let h = w / ratio;

            // If height exceeds page, scale by height instead
            if (h > pageHeight) {
                h = pageHeight;
                w = h * ratio;
            }

            // Center image
            const x = (pageWidth - w) / 2;
            const y = (pageHeight - h) / 2;

            pdf.addImage(imgData, 'PNG', x, y, w, h);
        });

        pdf.save('fullgrab-export.pdf');
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleEditorSave = async (newImage) => {
        setImage(newImage);
        setIsEditing(false);
        // Save to storage
        await chrome.storage.local.set({ capturedImage: newImage });
    };

    const requestDelete = () => {
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        await chrome.storage.local.remove(['capturedImage', 'originalCaptures']);
        setIsDeleted(true);
        setShowDeleteConfirm(false);
    };

    if (isDeleted) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                fontFamily: 'Inter, sans-serif',
                color: '#333',
                backgroundColor: '#f9fafb'
            }}>
                <div style={{
                    background: '#fee2e2',
                    padding: '20px',
                    borderRadius: '50%',
                    display: 'flex',
                    marginBottom: '20px'
                }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </div>
                <h2 style={{ fontSize: '24px', marginBottom: '8px', fontWeight: 600 }}>Image deleted</h2>
                <p style={{ color: '#6b7280' }}>This screenshot been deleted sucsessfully.</p>
            </div>
        );
    }

    if (!image) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#555' }}>
                <div style={{ marginBottom: '20px' }}>
                    <svg className="animate-spin" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                    </svg>
                </div>
                <p>Loading screenshot...</p>
            </div>
        );
    }

    if (isEditing) {
        return <ImageEditor imageSrc={image} onSave={handleEditorSave} onCancel={() => setIsEditing(false)} />;
    }

    return (
        <>
            <style>
                {`
          .zoom-btn {
            background: transparent;
            border: none;
            padding: 8px;
            border-radius: 50%;
            cursor: pointer;
            color: #555;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
          }
          .zoom-btn:hover {
            background-color: rgba(0,0,0,0.05);
            color: #000;
            transform: scale(1.1);
          }
          .zoom-btn:active {
            transform: scale(0.95);
          }

          .tool-btn {
            background: transparent;
            border: none;
            padding: 10px;
            border-radius: 8px;
            cursor: pointer;
            color: #6b7280;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            margin-left: 8px;
          }
          .tool-btn:hover {
            background-color: #f3f4f6;
            color: #111827;
            transform: translateY(-1px);
          }

          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          .animate-spin { animation: spin 1s linear infinite; }
          
          .modal-overlay {
             position: fixed;
             top: 0;
             left: 0;
             width: 100%;
             height: 100%;
             background: rgba(0,0,0,0.5);
             display: flex;
             align-items: center;
             justify-content: center;
             z-index: 9999;
             backdrop-filter: blur(4px);
             animation: fadeIn 0.2s ease-out;
          }
          .modal-box {
             background: white;
             padding: 30px;
             border-radius: 16px;
             width: 400px;
             text-align: center;
             box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
             animation: scaleIn 0.2s ease-out;
          }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }

          .btn-danger {
              background: #ef4444;
              color: white;
              padding: 10px 24px;
              border: none;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              margin-right: 12px;
              transition: background 0.2s;
          }
          .btn-danger:hover { background: #dc2626; }
          
          .btn-secondary {
              background: #f3f4f6;
              color: #374151;
              padding: 10px 24px;
              border: none;
              border-radius: 8px;
              font-weight: 600;
              cursor: pointer;
              transition: background 0.2s;
          }
          .btn-secondary:hover { background: #e5e7eb; }
        `}
            </style>

            {showDeleteConfirm && (
                <div className="modal-overlay">
                    <div className="modal-box">
                        <div style={{
                            background: '#fee2e2',
                            width: '50px',
                            height: '50px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 20px auto'
                        }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                        </div>
                        <h3 style={{ fontSize: '20px', marginBottom: '8px', fontFamily: 'sans-serif', fontWeight: 600, color: '#111827' }}>Delete Screenshot?</h3>
                        <p style={{ color: '#6b7280', marginBottom: '30px', fontFamily: 'sans-serif', lineHeight: 1.5 }}>This option cant to be undone.<br />Are you sure you want to proceed?</p>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>No, Keep it</button>
                            <button className="btn-danger" onClick={confirmDelete}>Yes, Delete</button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{
                width: '100vw',
                height: '100vh',
                backgroundColor: '#f0f2f5',
                position: 'relative',
                overflow: 'hidden'
            }}>

                {/* Top Header Bar */}
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '80px',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    zIndex: 50,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 30px',
                    boxSizing: 'border-box'
                }}>
                    {/* Logo on Left (Large) */}
                    <img
                        src="full.png"
                        alt="FullGrab"
                        style={{
                            height: '100px',
                            width: 'auto',
                            objectFit: 'contain'
                        }}
                    />

                    {/* Right Side Tools */}
                    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                        <button className="tool-btn" onClick={handleShare} disabled={isSharing} title="Share Link" style={{ marginRight: '8px' }}>
                            {isSharing ? (
                                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path></svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                            )}
                        </button>

                        {/* Shared Link Display */}
                        {sharedLink && (
                            <div style={{
                                position: 'absolute',
                                top: '60px',
                                right: '0',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                borderRadius: '12px',
                                padding: '16px 20px',
                                boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4), 0 2px 8px rgba(0,0,0,0.1)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                                zIndex: 1000,
                                minWidth: '350px',
                                animation: 'slideDown 0.3s ease-out',
                                border: '1px solid rgba(255,255,255,0.2)'
                            }}>
                                <style>{`
                                    @keyframes slideDown {
                                        from {
                                            opacity: 0;
                                            transform: translateY(-10px);
                                        }
                                        to {
                                            opacity: 1;
                                            transform: translateY(0);
                                        }
                                    }
                                    .copy-btn-modern {
                                        transition: all 0.2s ease;
                                    }
                                    .copy-btn-modern:hover {
                                        transform: translateY(-2px);
                                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                                    }
                                    .copy-btn-modern:active {
                                        transform: translateY(0);
                                    }
                                `}</style>

                                <div style={{
                                    fontSize: '12px',
                                    color: 'rgba(255,255,255,0.9)',
                                    fontWeight: '600',
                                    letterSpacing: '0.5px',
                                    textTransform: 'uppercase'
                                }}>
                                    Share Link Ready
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    <input
                                        type="text"
                                        value={sharedLink}
                                        readOnly
                                        style={{
                                            flex: 1,
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '10px 12px',
                                            fontSize: '13px',
                                            color: '#374151',
                                            backgroundColor: 'rgba(255,255,255,0.95)',
                                            fontFamily: 'monospace',
                                            outline: 'none'
                                        }}
                                    />
                                    <button
                                        className="copy-btn-modern"
                                        onClick={() => {
                                            navigator.clipboard.writeText(sharedLink);
                                            setSharedLink(null);
                                        }}
                                        style={{
                                            padding: '10px 16px',
                                            backgroundColor: 'rgba(255,255,255,0.95)',
                                            color: '#667eea',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: '600',
                                            whiteSpace: 'nowrap',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                        </svg>
                                        Copy
                                    </button>
                                </div>
                            </div>
                        )}

                        <button className="tool-btn" onClick={handleEdit} title="Edit">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button className="tool-btn" onClick={requestDelete} title="Delete" style={{ color: '#ef4444' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                        <div style={{ width: '1px', height: '24px', background: '#e5e7eb', margin: '0 12px' }}></div>
                        <button className="tool-btn" onClick={handleDownloadPDF} title="Download PDF">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        </button>
                        <button className="tool-btn" onClick={handleDownloadPNG} title="Download PNG" style={{ color: '#2563eb', background: '#eff6ff' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                    </div>
                </div>

                {/* Floating Modern Toolbar */}
                <div style={{
                    position: 'fixed',
                    bottom: '40px',
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
                    zIndex: 100
                }}>
                    <button onClick={handleZoomOut} className="zoom-btn" title="Zoom Out">
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

                    <button onClick={handleZoomIn} className="zoom-btn" title="Zoom In">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>

                {/* Scrollable Image Area */}
                <div style={{
                    width: '100%',
                    height: '100%',
                    overflow: 'auto',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-start',
                    padding: '120px 0 120px 0' // Adjusted Top padding for Header
                }}>
                    <div style={{
                        boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
                        backgroundColor: '#fff',
                        width: `${zoom}%`,
                        minWidth: '200px',
                        transition: 'width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                    }}>
                        <img
                            src={image}
                            alt="Screen Capture"
                            style={{
                                width: '100%',
                                height: 'auto',
                                display: 'block'
                            }}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Preview />);
