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
    const [showToast, setShowToast] = useState(false);
    const [showEditToast, setShowEditToast] = useState(false);
    const [showDownloadToast, setShowDownloadToast] = useState(false);
    const [downloadFormat, setDownloadFormat] = useState('');
    const [pageInfo, setPageInfo] = useState({ title: 'Screenshot', url: '' });

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

    const playSuccessSound = () => {
        // Create a simple success beep sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (e) {
            console.log('Could not play sound:', e);
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(sharedLink);
        setSharedLink(null);
        playSuccessSound();
        setShowToast(true);

        // Auto-hide toast after 5 seconds
        setTimeout(() => {
            setShowToast(false);
        }, 5000);
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

    // Fetch page info for filename generation
    useEffect(() => {
        chrome.storage.local.get(['pageTitle', 'pageUrl'], (result) => {
            if (result.pageTitle && result.pageUrl) {
                setPageInfo({ title: result.pageTitle, url: result.pageUrl });
            }
        });
    }, []);

    const generateFileName = async (extension) => {
        // Get and increment capture counter
        const result = await chrome.storage.local.get(['captureCounter']);
        const counter = (result.captureCounter || 0) + 1;
        await chrome.storage.local.set({ captureCounter: counter });

        // Format counter with leading zeros (3 digits)
        const formattedCounter = String(counter).padStart(3, '0');

        // Extract domain from URL
        let domain = 'capture';
        try {
            const urlObj = new URL(pageInfo.url);
            domain = urlObj.hostname.replace('www.', '');
        } catch (e) {
            // If URL parsing fails, use default
        }

        // Clean title (remove special characters that can't be in filenames)
        const cleanTitle = pageInfo.title.replace(/[<>:"/\\|?*]/g, '-').substring(0, 50);

        // Format: FullGrab Capture 003 - Page Title - [domain].extension
        return `FullGrab Capture ${formattedCounter} - ${cleanTitle} - [${domain}].${extension}`;
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 200));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 10));

    const handleDownloadPNG = async () => {
        const filename = await generateFileName('png');
        const link = document.createElement('a');
        link.href = image;
        link.download = filename;
        link.click();

        // Show success toast
        setDownloadFormat('PNG');
        setShowDownloadToast(true);
        setTimeout(() => {
            setShowDownloadToast(false);
        }, 3000);
    };

    const handleDownloadPDF = async () => {
        const filename = await generateFileName('pdf');
        if (!captures || captures.length === 0) {
            alert('No captures available to export.');
            return;
        }

        // Multi-page PDF
        // Create PDF with orientati    const handleDownloadPDF = async () => {
        // const filename = await generateFileName('pdf');
        // if (!captures || captures.length === 0) {
        //     alert('No captures available to export.');
        //     return;
        // }

        const pdf = new jsPDF({
            orientation: 'portrait',
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

        pdf.save(filename);

        // Show success toast
        setDownloadFormat('PDF');
        setShowDownloadToast(true);
        setTimeout(() => {
            setShowDownloadToast(false);
        }, 3000);
    };

    const handleEdit = () => {
        setShowEditToast(true);

        // Auto-hide toast after 3 seconds
        setTimeout(() => {
            setShowEditToast(false);
        }, 3000);
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
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                fontFamily: "'Inter', sans-serif",
                padding: '20px'
            }}>
                <style>{`
                    @keyframes checkmarkScale {
                        0% { transform: scale(0); opacity: 0; }
                        50% { transform: scale(1.1); }
                        100% { transform: scale(1); opacity: 1; }
                    }
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>

                <div style={{
                    background: 'white',
                    borderRadius: '24px',
                    padding: '60px 80px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    textAlign: 'center',
                    maxWidth: '500px',
                    animation: 'fadeInUp 0.5s ease-out'
                }}>
                    {/* Animated Icon */}
                    <div style={{
                        width: '100px',
                        height: '100px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 30px auto',
                        animation: 'checkmarkScale 0.5s ease-out 0.2s both'
                    }}>
                        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </div>

                    {/* Title */}
                    <h2 style={{
                        fontSize: '32px',
                        marginBottom: '12px',
                        fontWeight: 700,
                        color: '#111827',
                        letterSpacing: '-0.5px'
                    }}>
                        Screenshot Deleted
                    </h2>

                    {/* Message */}
                    <p style={{
                        color: '#6b7280',
                        fontSize: '16px',
                        marginBottom: '40px',
                        lineHeight: 1.6
                    }}>
                        Your screenshot has been permanently deleted from storage.
                    </p>

                    {/* Action Button */}
                    <button
                        onClick={() => window.close()}
                        style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            padding: '14px 32px',
                            borderRadius: '12px',
                            fontSize: '16px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                        }}
                        onMouseOver={(e) => {
                            e.target.style.transform = 'translateY(-2px)';
                            e.target.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseOut={(e) => {
                            e.target.style.transform = 'translateY(0)';
                            e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                        }}
                    >
                        Close Window
                    </button>
                </div>
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
            background: rgba(255, 255, 255, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 10px;
            border-radius: 10px;
            cursor: pointer;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            margin-left: 8px;
            backdrop-filter: blur(10px);
          }
          .tool-btn:hover {
            background: rgba(255, 255, 255, 0.3);
            border-color: rgba(255, 255, 255, 0.5);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }
          .tool-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          
          .tool-btn-wrapper {
            position: relative;
            display: inline-flex;
          }
          
          .tooltip {
            position: absolute;
            bottom: -45px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease, transform 0.2s ease;
            z-index: 10000;
            backdrop-filter: blur(10px);
          }
          
          .tooltip::before {
            content: '';
            position: absolute;
            top: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-bottom: 5px solid rgba(0, 0, 0, 0.9);
          }
          
          .tool-btn-wrapper:hover .tooltip {
            opacity: 1;
            transform: translateX(-50%) translateY(2px);
          }
          
          /* Header Button Styles */
          .header-btn {
            position: relative;
            padding: 8px;
            background: transparent;
            border: none;
            borderRadius: 8px;
            cursor: pointer;
            color: white;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          
          .header-btn:hover {
            background: rgba(255, 255, 255, 0.25) !important;
            transform: translateY(-2px);
          }
          
          .header-btn:active {
            transform: translateY(0);
          }
          
          .header-btn-delete {
            color: #fca5a5;
          }
          
          .header-btn-delete:hover {
            background: rgba(239, 68, 68, 0.25) !important;
            color: white !important;
          }
          
          /* Header Tooltip Styles */
          .header-tooltip-wrapper {
            position: relative;
            display: inline-flex;
          }
          
          .header-tooltip {
            position: absolute;
            bottom: -35px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
            z-index: 10000;
          }
          
          .header-tooltip::before {
            content: '';
            position: absolute;
            top: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-bottom: 5px solid rgba(0, 0, 0, 0.95);
          }
          
          .header-tooltip-wrapper:hover .header-tooltip {
            opacity: 1;
          }
          
          /* Download Button Styles */
          .download-btn-pdf {
            padding: 8px 16px;
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.4);
            border-radius: 12px;
            color: white;
            cursor: pointer;
            fontSize: 14px;
            fontWeight: 600;
            display: flex;
            alignItems: center;
            gap: 8px;
            backdropFilter: blur(10px);
            transition: all 0.2s ease;
          }
          
          .download-btn-pdf:hover {
            background: rgba(255,255,255,0.35) !important;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0,0,0,0.15);
          }
          
          .download-btn-pdf:active {
            transform: translateY(0);
          }
          
          .download-btn-png {
            padding: 8px 16px;
            background: white;
            border: none;
            border-radius: 12px;
            color: #a855f7;
            cursor: pointer;
            fontSize: 14px;
            fontWeight: 700;
            display: flex;
            alignItems: center;
            gap: 8px;
            boxShadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
          }
          
          .download-btn-png:hover {
            background: #f3f4f6 !important;
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.25);
          }
          
          .download-btn-png:active {
            transform: translateY(0);
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
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
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

                {/* Top Header Bar - New Gradient Design */}
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    background: 'linear-gradient(to right, #fb923c, #ec4899, #a855f7)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    color: 'white',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                    zIndex: 50,
                    boxSizing: 'border-box'
                }}>
                    {/* Logo Section - Left */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', userSelect: 'none' }}>
                            {/* Icon */}
                            <div style={{
                                position: 'relative',
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <path d="m14.31 8 5.74 9.94" />
                                    <path d="M9.69 8h11.48" />
                                    <path d="m7.38 12 5.74-9.94" />
                                    <path d="M9.69 16 3.95 6.06" />
                                    <path d="M14.31 16H2.83" />
                                    <path d="m16.62 12-5.74 9.94" />
                                </svg>
                            </div>

                            {/* Brand Text */}
                            <div style={{ display: 'flex', alignItems: 'baseline', lineHeight: 1 }}>
                                <span style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', color: 'white' }}>Full</span>
                                <span style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.5px', color: '#a855f7' }}>Grab</span>
                            </div>
                        </div>
                    </div>

                    {/* Center Actions (Edit, Share, Delete) */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        backdropFilter: 'blur(10px)',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        padding: '8px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                        {/* Edit Button */}
                        <div className="header-tooltip-wrapper">
                            <button className="header-btn" onClick={handleEdit}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m18.226 5.226-2.52-2.52A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.351" />
                                    <path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />
                                    <path d="M8 18h1" />
                                </svg>
                            </button>
                            <span className="header-tooltip">Edit - Coming Soon</span>
                        </div>

                        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.3)' }}></div>

                        {/* Share Button */}
                        <div className="header-tooltip-wrapper">
                            <button className="header-btn" onClick={handleShare} disabled={isSharing}>
                                {isSharing ? (
                                    <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"></path>
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                                    </svg>
                                )}
                            </button>
                            <span className="header-tooltip">Share with link</span>
                        </div>

                        {/* Shared Link Display */}
                        {sharedLink && (
                            <div style={{
                                position: 'absolute',
                                top: '70px',
                                left: '50%',
                                transform: 'translateX(-50%)',
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
                                            transform: translateX(-50%) translateY(-10px);
                                        }
                                        to {
                                            opacity: 1;
                                            transform: translateX(-50%) translateY(0);
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
                                        onClick={handleCopyLink}
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

                        <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.3)' }}></div>

                        {/* Delete Button */}
                        <div className="header-tooltip-wrapper">
                            <button className="header-btn header-btn-delete" onClick={requestDelete}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 11v6" />
                                    <path d="M14 11v6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                            </button>
                            <span className="header-tooltip">Delete image</span>
                        </div>
                    </div>

                    {/* Right Actions (Download Buttons) */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {/* PDF Button */}
                        <div className="header-tooltip-wrapper">
                            <button className="download-btn-pdf" onClick={handleDownloadPDF}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <line x1="10" y1="9" x2="8" y2="9"></line>
                                </svg>
                                PDF
                            </button>
                            <span className="header-tooltip">Download as PDF</span>
                        </div>

                        {/* PNG Button */}
                        <div className="header-tooltip-wrapper">
                            <button className="download-btn-png" onClick={handleDownloadPNG}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21 15 16 10 5 21"></polyline>
                                </svg>
                                PNG
                            </button>
                            <span className="header-tooltip">Download as PNG</span>
                        </div>
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

            {/* Toast Notification */}
            {showToast && (
                <div style={{
                    position: 'fixed',
                    bottom: '30px',
                    right: '30px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
                    zIndex: 10000,
                    minWidth: '320px',
                    animation: 'slideInRight 0.3s ease-out',
                    overflow: 'hidden'
                }}>
                    <style>{`
                        @keyframes slideInRight {
                            from {
                                opacity: 0;
                                transform: translateX(100px);
                            }
                            to {
                                opacity: 1;
                                transform: translateX(0);
                            }
                        }
                        @keyframes countdownBar {
                            from {
                                width: 100%;
                            }
                            to {
                                width: 0%;
                            }
                        }
                    `}</style>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        {/* Success Icon */}
                        <div style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>
                                Success!
                            </div>
                            <div style={{ fontSize: '13px', opacity: 0.9 }}>
                                Link copied to clipboard
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        backgroundColor: 'rgba(255,255,255,0.2)'
                    }}>
                        <div style={{
                            height: '100%',
                            backgroundColor: 'white',
                            animation: 'countdownBar 5s linear forwards'
                        }}></div>
                    </div>
                </div>
            )}

            {/* Edit Coming Soon Toast */}
            {showEditToast && (
                <div style={{
                    position: 'fixed',
                    bottom: '30px',
                    right: '30px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
                    zIndex: 10000,
                    minWidth: '320px',
                    animation: 'slideInRight 0.3s ease-out',
                    overflow: 'hidden'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        {/* Info Icon */}
                        <div style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>
                                Coming Soon!
                            </div>
                            <div style={{ fontSize: '13px', opacity: 0.9 }}>
                                Edit feature is under development
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        backgroundColor: 'rgba(255,255,255,0.2)'
                    }}>
                        <div style={{
                            height: '100%',
                            backgroundColor: 'white',
                            animation: 'countdownBar 3s linear forwards'
                        }}></div>
                    </div>
                </div>
            )}

            {/* Download Success Toast */}
            {showDownloadToast && (
                <div style={{
                    position: 'fixed',
                    bottom: '30px',
                    right: '30px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(16, 185, 129, 0.4)',
                    zIndex: 10000,
                    minWidth: '320px',
                    animation: 'slideInRight 0.3s ease-out',
                    overflow: 'hidden'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                        {/* Download Icon */}
                        <div style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>
                                Download Complete!
                            </div>
                            <div style={{ fontSize: '13px', opacity: 0.9 }}>
                                {downloadFormat} downloaded successfully
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        backgroundColor: 'rgba(255,255,255,0.2)'
                    }}>
                        <div style={{
                            height: '100%',
                            backgroundColor: 'white',
                            animation: 'countdownBar 3s linear forwards'
                        }}></div>
                    </div>
                </div>
            )}
        </>
    );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<Preview />);
