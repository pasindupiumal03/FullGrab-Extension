import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { jsPDF } from "jspdf";
import "./index.css";
import UserInfoWidget from "./components/UserInfoWidget";
import PremiumFeatureModal from "./components/PremiumFeatureModal";
import TrialExpiredScreen from "./components/TrialExpiredScreen";
import { isPremiumUser, hasAccess } from "./controllers/subscriptionController";
import { authService } from "./services/authService";
import { STORAGE_KEYS } from "./constants/config";

const EditPage = () => {
  const [image, setImage] = useState(null);
  const [captures, setCaptures] = useState([]);
  const [activeTool, setActiveTool] = useState("background");
  const [selectedGradient, setSelectedGradient] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [frameStyle, setFrameStyle] = useState("none");
  const [imageSize, setImageSize] = useState(100);
  const [paddingSize, setPaddingSize] = useState(40);
  const [cornerRadius, setCornerRadius] = useState(12);
  const [shadowIntensity, setShadowIntensity] = useState(20);
  const [textOverlays, setTextOverlays] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [shapes, setShapes] = useState([]);
  const [hasAppAccess, setHasAppAccess] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const checkAccess = async () => {
    const access = await hasAccess();
    const authed = await authService.isAuthenticated();
    setHasAppAccess(access);
    setIsAuthenticated(authed);

    // Edit page is a strict premium feature
    const premium = await isPremiumUser();
    if (!premium) {
      setShowPremiumModal(true);
    } else {
      setShowPremiumModal(false);
    }
  };

  useEffect(() => {
    checkAccess();

    const handleStorageChange = (changes, area) => {
      if (area === "local" && changes[STORAGE_KEYS.AUTH]) {
        console.log("Auth state changed in storage, refreshing access...");
        checkAccess();
      }
    };

    const handleFocus = () => {
      console.log("Edit focused, refreshing access...");
      checkAccess();
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);
  const [brushSize, setBrushSize] = useState(5);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [brushColor, setBrushColor] = useState("#a855f7");
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [draggingTextId, setDraggingTextId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedShapeId, setSelectedShapeId] = useState(null);
  const [draggingShapeId, setDraggingShapeId] = useState(null);
  const [shapeDragOffset, setShapeDragOffset] = useState({ x: 0, y: 0 });
  const [drawingPaths, setDrawingPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [canvasRef, setCanvasRef] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [cropStart, setCropStart] = useState(null);
  const [cropEnd, setCropEnd] = useState(null);
  const [cropRect, setCropRect] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [sharedLink, setSharedLink] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [showDownloadToast, setShowDownloadToast] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState("");
  const [pageInfo, setPageInfo] = useState({ title: "Screenshot", url: "" });
  const [counter, setCounter] = useState(1);
  const [backgroundEnabled, setBackgroundEnabled] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedo, setIsUndoRedo] = useState(false);
  const [zoom, setZoom] = useState(50);

  // Save current state to history
  const saveToHistory = () => {
    const state = {
      textOverlays: [...textOverlays],
      shapes: [...shapes],
      drawingPaths: [...drawingPaths],
      backgroundEnabled,
      selectedGradient,
      selectedColor,
      frameStyle,
      imageSize,
      paddingSize,
      cornerRadius,
      shadowIntensity
    };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(state);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    console.log("History saved. Index:", newHistory.length - 1, "Total:", newHistory.length);
  };

  // Undo function
  const handleUndo = () => {
    if (historyIndex > 0) {
      setIsUndoRedo(true);
      const newIndex = historyIndex - 1;
      const state = history[newIndex];
      setTextOverlays(state.textOverlays);
      setShapes(state.shapes);
      setDrawingPaths(state.drawingPaths);
      setBackgroundEnabled(state.backgroundEnabled);
      setSelectedGradient(state.selectedGradient);
      setSelectedColor(state.selectedColor);
      setFrameStyle(state.frameStyle);
      setImageSize(state.imageSize);
      setPaddingSize(state.paddingSize);
      setCornerRadius(state.cornerRadius);
      setShadowIntensity(state.shadowIntensity);
      setHistoryIndex(newIndex);
      setTimeout(() => setIsUndoRedo(false), 200);
      console.log("Undo to index:", newIndex);
    }
  };

  // Redo function
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setIsUndoRedo(true);
      const newIndex = historyIndex + 1;
      const state = history[newIndex];
      setTextOverlays(state.textOverlays);
      setShapes(state.shapes);
      setDrawingPaths(state.drawingPaths);
      setBackgroundEnabled(state.backgroundEnabled);
      setSelectedGradient(state.selectedGradient);
      setSelectedColor(state.selectedColor);
      setFrameStyle(state.frameStyle);
      setImageSize(state.imageSize);
      setPaddingSize(state.paddingSize);
      setCornerRadius(state.cornerRadius);
      setShadowIntensity(state.shadowIntensity);
      setHistoryIndex(newIndex);
      setTimeout(() => setIsUndoRedo(false), 200);
      console.log("Redo to index:", newIndex);
    }
  };

  // Save current canvas state
  const handleSave = async () => {
    try {
      // Get the edit canvas container
      const editCanvas = document.getElementById("edit-canvas");
      if (!editCanvas) {
        console.error("Edit canvas not found");
        alert("Could not find canvas to save");
        return;
      }

      // Get the image element
      const imgElement = editCanvas.querySelector("img");
      if (!imgElement) {
        console.error("Image element not found");
        alert("Could not find image to save");
        return;
      }

      // Create a canvas to capture the current state
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Set canvas dimensions to match the image
      canvas.width = imgElement.naturalWidth;
      canvas.height = imgElement.naturalHeight;

      // Draw the image
      ctx.drawImage(imgElement, 0, 0);

      // Save to storage
      const imageData = canvas.toDataURL("image/png");
      await new Promise((resolve) => {
        chrome.storage.local.set({ capturedImage: imageData }, resolve);
      });

      console.log("Image saved successfully");
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2000);
    } catch (error) {
      console.error("Error saving image:", error);
      alert("Failed to save image: " + error.message);
    }
  };

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 10));

  useEffect(() => {
    // Load the image and page info from storage
    chrome.storage.local.get(
      ["capturedImage", "originalCaptures", "pageTitle", "pageUrl", "screenshotCounter"],
      (result) => {
        if (result.capturedImage) {
          setImage(result.capturedImage);
        }
        if (result.originalCaptures) {
          setCaptures(result.originalCaptures);
        }
        if (result.pageTitle && result.pageUrl) {
          setPageInfo({ title: result.pageTitle, url: result.pageUrl });
        }
        if (result.screenshotCounter) {
          setCounter(result.screenshotCounter);
        }
      }
    );
  }, []);

  // Save initial history state when component mounts
  useEffect(() => {
    if (image && history.length === 0) {
      // Delay to ensure all state is loaded
      const timer = setTimeout(() => {
        const initialState = {
          textOverlays: [],
          shapes: [],
          drawingPaths: [],
          backgroundEnabled,
          selectedGradient,
          selectedColor,
          frameStyle,
          imageSize,
          paddingSize,
          cornerRadius,
          shadowIntensity
        };
        setHistory([initialState]);
        setHistoryIndex(0);
        console.log("Initial history saved");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [image]);

  // Auto-save history when important states change (for undo/redo)
  useEffect(() => {
    if (history.length > 0 && !isUndoRedo) {
      const timer = setTimeout(() => {
        saveToHistory();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [
    textOverlays,
    shapes,
    drawingPaths,
    backgroundEnabled,
    selectedGradient,
    selectedColor,
    frameStyle
  ]);

  const generateFileName = async (extension) => {
    const formattedCounter = String(counter).padStart(3, "0");

    // Extract domain from URL
    let domain = "webpage";
    try {
      const url = new URL(pageInfo.url);
      domain = url.hostname.replace("www.", "");
    } catch (e) {
      console.error("Invalid URL:", e);
    }

    // Clean title
    const cleanTitle = pageInfo.title.replace(/[<>:"/\\|?*]/g, "-").substring(0, 50);

    return `FullGrab Capture ${formattedCounter} - ${cleanTitle} - [${domain}].${extension}`;
  };

  const captureEditedCanvas = () => {
    return new Promise((resolve) => {
      if (!image) {
        resolve(image);
        return;
      }

      // Get the edit canvas element
      const editCanvas = document.getElementById("edit-canvas");
      if (!editCanvas) {
        resolve(image);
        return;
      }

      // Use html2canvas to capture the entire edited canvas with all overlays
      import("html2canvas")
        .then((html2canvas) => {
          html2canvas
            .default(editCanvas, {
              backgroundColor: null,
              scale: 2, // Higher quality
              logging: false,
              useCORS: true,
              allowTaint: true
            })
            .then((canvas) => {
              resolve(canvas.toDataURL("image/png"));
            })
            .catch((err) => {
              console.error("Failed to capture canvas:", err);
              // Fallback to basic capture
              captureEditedCanvasFallback().then(resolve);
            });
        })
        .catch((err) => {
          console.error("Failed to load html2canvas:", err);
          // Fallback to basic capture
          captureEditedCanvasFallback().then(resolve);
        });
    });
  };

  const captureEditedCanvasFallback = () => {
    return new Promise((resolve) => {
      if (!image) {
        resolve(image);
        return;
      }

      // Create a temporary canvas to composite the edited version
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Load the image to get its dimensions
      const img = new Image();
      img.onload = () => {
        // Calculate actual dimensions based on imageSize scale
        const scaledWidth = img.width * (imageSize / 100);
        const scaledHeight = img.height * (imageSize / 100);

        // Set canvas size to match scaled image + padding
        const totalPadding = paddingSize * 2;
        canvas.width = scaledWidth + totalPadding;
        canvas.height = scaledHeight + totalPadding;

        // Fill background if enabled
        if (backgroundEnabled) {
          if (selectedGradient) {
            // Create gradient - parse the CSS gradient string
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            const gradientMatch = selectedGradient.match(/linear-gradient\(135deg,\s*([^)]+)\)/);
            if (gradientMatch) {
              const colors = gradientMatch[1].split(",").map((c) => c.trim());
              colors.forEach((color) => {
                const parts = color.split(/\s+/);
                const percentage = parts[parts.length - 1];
                const colorValue = parts.slice(0, -1).join(" ");
                const stop = parseFloat(percentage) / 100;
                gradient.addColorStop(stop, colorValue);
              });
              ctx.fillStyle = gradient;
            } else {
              ctx.fillStyle = selectedGradient;
            }
          } else if (selectedColor) {
            ctx.fillStyle = selectedColor;
          } else {
            // Default gradient
            const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, "#FF6B6B");
            gradient.addColorStop(1, "#FFB88C");
            ctx.fillStyle = gradient;
          }
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
          // No background - transparent or white
          ctx.fillStyle = "#f9fafb";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Apply frame effects
        ctx.save();

        // Add shadows/glow based on frameStyle
        if (frameStyle === "shadow") {
          ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
          ctx.shadowBlur = shadowIntensity * 2;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = shadowIntensity;
        } else if (frameStyle === "glow") {
          ctx.shadowColor = "rgba(168, 85, 247, 0.6)";
          ctx.shadowBlur = shadowIntensity;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        } else {
          ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
          ctx.shadowBlur = shadowIntensity;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = shadowIntensity / 2;
        }

        // Draw border if frameStyle is 'border'
        if (frameStyle === "border") {
          ctx.strokeStyle = "white";
          ctx.lineWidth = 4;
        }

        // Add corner radius by clipping
        ctx.beginPath();
        const x = paddingSize;
        const y = paddingSize;
        const w = scaledWidth;
        const h = scaledHeight;
        const r = cornerRadius;

        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.clip();

        // Draw the image
        ctx.drawImage(img, paddingSize, paddingSize, scaledWidth, scaledHeight);

        if (frameStyle === "border") {
          ctx.stroke();
        }

        ctx.restore();

        // Draw text overlays
        textOverlays.forEach((overlay) => {
          ctx.save();
          ctx.font = `bold ${overlay.fontSize}px Arial`;
          ctx.fillStyle = overlay.color;
          ctx.shadowColor = "rgba(0,0,0,0.5)";
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;

          const textX = (overlay.x / 100) * canvas.width;
          const textY = (overlay.y / 100) * canvas.height;
          ctx.fillText(overlay.text, textX, textY);
          ctx.restore();
        });

        // Draw shapes
        shapes.forEach((shape) => {
          ctx.save();
          const shapeX = (shape.x / 100) * canvas.width;
          const shapeY = (shape.y / 100) * canvas.height;
          const size = shape.size;

          ctx.translate(shapeX, shapeY);
          if (shape.rotation) {
            ctx.rotate((shape.rotation * Math.PI) / 180);
          }

          ctx.fillStyle = shape.color;
          ctx.strokeStyle = shape.color;
          ctx.lineWidth = 3;

          // Draw shape based on type
          if (shape.type === "Circle") {
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            if (shape.style === "filled") ctx.fill();
            else ctx.stroke();
          } else if (shape.type === "Square") {
            ctx.beginPath();
            ctx.rect(-size / 2, -size / 2, size, size);
            if (shape.style === "filled") ctx.fill();
            else ctx.stroke();
          } else if (shape.type === "Triangle") {
            ctx.beginPath();
            ctx.moveTo(0, -size / 2);
            ctx.lineTo(size / 2, size / 2);
            ctx.lineTo(-size / 2, size / 2);
            ctx.closePath();
            if (shape.style === "filled") ctx.fill();
            else ctx.stroke();
          }

          ctx.restore();
        });

        // Draw brush paths
        if (drawingPaths.length > 0) {
          drawingPaths.forEach((path) => {
            ctx.save();
            ctx.strokeStyle = path.color;
            ctx.lineWidth = path.size;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.globalAlpha = path.opacity / 100;

            ctx.beginPath();
            if (path.points.length > 0) {
              ctx.moveTo(path.points[0].x, path.points[0].y);
              for (let i = 1; i < path.points.length; i++) {
                ctx.lineTo(path.points[i].x, path.points[i].y);
              }
            }
            ctx.stroke();
            ctx.restore();
          });
        }

        // Convert to data URL
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = image;
    });
  };

  const handleShare = async () => {
    if (!image || isSharing) return;

    setIsSharing(true);
    try {
      // Capture the edited canvas
      const editedImage = await captureEditedCanvas();
      const base64Image = editedImage.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

      const formData = new FormData();
      formData.append("key", "53fce98db6e1008f5c0ec630f5572936");
      formData.append("image", base64Image);

      const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (result.success) {
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

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this screenshot?")) {
      chrome.storage.local.remove(["capturedImage", "originalCaptures"], () => {
        window.close();
      });
    }
  };

  const handleDownloadPNG = async () => {
    const filename = await generateFileName("png");

    // Capture the edited canvas
    const editedImage = await captureEditedCanvas();

    const link = document.createElement("a");
    link.href = editedImage;
    link.download = filename;
    link.click();

    // Show success toast
    setDownloadFormat("PNG");
    setShowDownloadToast(true);
    setTimeout(() => {
      setShowDownloadToast(false);
    }, 3000);
  };

  const handleDownloadPDF = async () => {
    const filename = await generateFileName("pdf");

    // Capture the edited canvas
    const editedImage = await captureEditedCanvas();

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: "a4"
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgProps = pdf.getImageProperties(editedImage);
    const ratio = imgProps.width / imgProps.height;

    let w = pageWidth;
    let h = w / ratio;

    if (h > pageHeight) {
      h = pageHeight;
      w = h * ratio;
    }

    const x = (pageWidth - w) / 2;
    const y = (pageHeight - h) / 2;

    pdf.addImage(editedImage, "PNG", x, y, w, h);
    pdf.save(filename);

    // Show success toast
    setDownloadFormat("PDF");
    setShowDownloadToast(true);
    setTimeout(() => {
      setShowDownloadToast(false);
    }, 3000);
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
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (e) {
      console.log("Could not play sound:", e);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(sharedLink);
    setSharedLink(null);
    playSuccessSound();
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
    }, 5000);
  };

  const handlePostout = async (platform) => {
    if (!image) return;

    // Show loading state
    setIsSharing(true);

    try {
      // Capture the edited canvas
      const editedImage = await captureEditedCanvas();
      const base64Image = editedImage.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

      // Upload to imgbb
      const formData = new FormData();
      formData.append("key", "53fce98db6e1008f5c0ec630f5572936");
      formData.append("image", base64Image);

      const response = await fetch("https://api.imgbb.com/1/upload", {
        method: "POST",
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        const imageUrl = result.data.url;
        const postText = "FullGrab - Screenshot & Full Page Capture Extension";

        // Platform-specific URLs
        let shareUrl;
        switch (platform) {
          case "Twitter/X":
            shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(postText)}&url=${encodeURIComponent(imageUrl)}`;
            break;
          case "Facebook":
            shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imageUrl)}&quote=${encodeURIComponent(postText)}`;
            break;
          case "LinkedIn":
            shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(imageUrl)}`;
            break;
          case "Instagram":
            // Instagram doesn't support direct web sharing, open imgbb link
            alert(
              "Instagram sharing: Please copy the image URL and share it manually in the Instagram app.\n\nImage URL: " +
                imageUrl
            );
            navigator.clipboard.writeText(imageUrl);
            return;
          default:
            return;
        }

        // Open in new tab
        chrome.tabs.create({ url: shareUrl });
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

  const handleAddText = () => {
    if (textInput.trim()) {
      const newText = {
        id: Date.now(),
        text: textInput,
        x: 50, // Center horizontally
        y: 50, // Center vertically
        fontSize: 24,
        color: "#ffffff"
      };
      setTextOverlays([...textOverlays, newText]);
      setTextInput("");
      setSelectedTextId(newText.id); // Auto-select new text for editing
    }
  };

  const handleAddShape = (shapeType) => {
    const newShape = {
      id: Date.now(),
      type: shapeType,
      x: 50, // Center horizontally
      y: 50, // Center vertically
      size: 50,
      color: "#ffffff",
      style: "filled", // 'filled' or 'outline'
      rotation: 0 // degrees
    };
    setShapes([...shapes, newShape]);
    setSelectedShapeId(newShape.id); // Auto-select new shape
  };

  const handleRemoveText = (id) => {
    setTextOverlays(textOverlays.filter((t) => t.id !== id));
  };

  const handleRemoveShape = (id) => {
    setShapes(shapes.filter((s) => s.id !== id));
  };

  const handleTextMouseDown = (e, textId) => {
    if (isDrawing) return; // Don't interfere with drawing mode
    e.preventDefault();
    setSelectedTextId(textId);
    setDraggingTextId(textId);
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    const textOverlay = textOverlays.find((t) => t.id === textId);
    setDragOffset({
      x: ((e.clientX - rect.left) / rect.width) * 100 - textOverlay.x,
      y: ((e.clientY - rect.top) / rect.height) * 100 - textOverlay.y
    });
  };

  const handleTextMouseMove = (e) => {
    if (isDrawing || !draggingTextId) return;
    const canvas = document.getElementById("edit-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const newX = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100 - dragOffset.x)
    );
    const newY = Math.max(
      0,
      Math.min(100, ((e.clientY - rect.top) / rect.height) * 100 - dragOffset.y)
    );
    setTextOverlays(
      textOverlays.map((t) => (t.id === draggingTextId ? { ...t, x: newX, y: newY } : t))
    );
  };

  const handleTextMouseUp = () => {
    setDraggingTextId(null);
  };

  const updateSelectedTextColor = (color) => {
    if (!selectedTextId) return;
    setTextOverlays(textOverlays.map((t) => (t.id === selectedTextId ? { ...t, color } : t)));
  };

  const updateSelectedTextSize = (fontSize) => {
    if (!selectedTextId) return;
    setTextOverlays(
      textOverlays.map((t) => (t.id === selectedTextId ? { ...t, fontSize: Number(fontSize) } : t))
    );
  };

  const handleShapeMouseDown = (e, shapeId) => {
    if (isDrawing) return; // Don't interfere with drawing mode
    e.preventDefault();
    setSelectedShapeId(shapeId);
    setDraggingShapeId(shapeId);
    const rect = e.currentTarget.parentElement.getBoundingClientRect();
    const shape = shapes.find((s) => s.id === shapeId);
    setShapeDragOffset({
      x: ((e.clientX - rect.left) / rect.width) * 100 - shape.x,
      y: ((e.clientY - rect.top) / rect.height) * 100 - shape.y
    });
  };

  const handleShapeMouseMove = (e) => {
    if (isDrawing || !draggingShapeId) return;
    const canvas = document.getElementById("edit-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const newX = Math.max(
      0,
      Math.min(100, ((e.clientX - rect.left) / rect.width) * 100 - shapeDragOffset.x)
    );
    const newY = Math.max(
      0,
      Math.min(100, ((e.clientY - rect.top) / rect.height) * 100 - shapeDragOffset.y)
    );
    setShapes(shapes.map((s) => (s.id === draggingShapeId ? { ...s, x: newX, y: newY } : s)));
  };

  const handleShapeMouseUp = () => {
    setDraggingShapeId(null);
  };

  const updateSelectedShapeColor = (color) => {
    if (!selectedShapeId) return;
    setShapes(shapes.map((s) => (s.id === selectedShapeId ? { ...s, color } : s)));
  };

  const updateSelectedShapeSize = (size) => {
    if (!selectedShapeId) return;
    setShapes(shapes.map((s) => (s.id === selectedShapeId ? { ...s, size: Number(size) } : s)));
  };

  const updateSelectedShapeStyle = (style) => {
    if (!selectedShapeId) return;
    setShapes(shapes.map((s) => (s.id === selectedShapeId ? { ...s, style } : s)));
  };

  const updateSelectedShapeRotation = (rotation) => {
    if (!selectedShapeId) return;
    setShapes(
      shapes.map((s) => (s.id === selectedShapeId ? { ...s, rotation: Number(rotation) } : s))
    );
  };

  const handleCanvasMouseDown = (e) => {
    if (!isDrawing) return;
    const canvas = document.getElementById("drawing-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setCurrentPath({
      points: [{ x, y }],
      color: brushColor,
      size: brushSize,
      opacity: brushOpacity / 100
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDrawing || !currentPath) return;
    const canvas = document.getElementById("drawing-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setCurrentPath({
      ...currentPath,
      points: [...currentPath.points, { x, y }]
    });
  };

  const handleCanvasMouseUp = () => {
    if (currentPath && currentPath.points.length > 0) {
      setDrawingPaths([...drawingPaths, currentPath]);
      setCurrentPath(null);
    }
  };

  const handleCropMouseDown = (e) => {
    if (!isCropping) return;
    const canvas = document.getElementById("edit-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCropStart({ x, y });
    setCropEnd(null);
    setCropRect(null);
  };

  const handleCropMouseMove = (e) => {
    if (!isCropping || !cropStart) return;
    const canvas = document.getElementById("edit-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCropEnd({ x, y });

    const left = Math.min(cropStart.x, x);
    const top = Math.min(cropStart.y, y);
    const width = Math.abs(x - cropStart.x);
    const height = Math.abs(y - cropStart.y);
    setCropRect({ left, top, width, height });
  };

  const handleCropMouseUp = () => {
    if (isCropping && cropStart) {
      // Stop dragging - clear cropStart to prevent further updates
      setCropStart(null);
      setCropEnd(null);
    }
  };

  useEffect(() => {
    const canvas = document.getElementById("drawing-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all saved paths
    [...drawingPaths, currentPath].filter(Boolean).forEach((path) => {
      if (path.points.length < 2) return;
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = path.opacity;
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }, [drawingPaths, currentPath]);

  const gradients = [
    "linear-gradient(135deg, #FF512F 0%, #DD2476 100%)",
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
    "linear-gradient(135deg, #fdbb2d 0%, #22c1c3 100%)",
    "linear-gradient(135deg, #e94057 0%, #8a2387 100%)"
  ];

  const solidColors = [
    "#FFFFFF",
    "#F3F4F6",
    "#E5E7EB",
    "#D1D5DB",
    "#9CA3AF",
    "#6B7280",
    "#4B5563",
    "#374151",
    "#1F2937",
    "#111827",
    "#EF4444",
    "#F59E0B",
    "#10B981",
    "#3B82F6",
    "#6366F1",
    "#8B5CF6"
  ];

  const getToolIcon = (toolId, isActive) => {
    const color = "currentColor";
    const icons = {
      background: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      frame: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="7" y="7" width="10" height="10" rx="1" />
        </svg>
      ),
      resize: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      ),
      crop: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </svg>
      ),
      text: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      ),
      shapes: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      ),
      brush: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
          <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z" />
        </svg>
      ),
      postout: (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      )
    };
    return icons[toolId];
  };

  const tools = [
    { id: "background", label: "Add BG" },
    { id: "frame", label: "Frame" },
    { id: "resize", label: "Resize" },
    { id: "crop", label: "Crop" },
    { id: "text", label: "Text" },
    { id: "shapes", label: "Shapes" },
    { id: "brush", label: "Brush" },
    { id: "postout", label: "Postout" }
  ];

  if (!hasAppAccess) {
    return <TrialExpiredScreen isAuthenticated={isAuthenticated} />;
  }

  return (
    <>
      <PremiumFeatureModal
        isOpen={showPremiumModal}
        onClose={() => (window.location.href = "preview.html")}
      />
      <style>{`
                /* Hide scrollbar for sidebar */
                .edit-sidebar::-webkit-scrollbar {
                    display: none;
                }
                
                /* Custom Scrollbar for Properties Panel */
                .properties-panel::-webkit-scrollbar {
                    width: 6px;
                }
                .properties-panel::-webkit-scrollbar-track {
                    background: transparent;
                }
                .properties-panel::-webkit-scrollbar-thumb {
                    background-color: #E5E7EB;
                    border-radius: 3px;
                }
                .properties-panel::-webkit-scrollbar-thumb:hover {
                    background-color: #D1D5DB;
                }
                
                /* Zoom Button Styles */
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

                /* Tool Sidebar Buttons - Dark Theme */
                .sidebar-tool-btn {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: transparent;
                    color: #374151;
                    border: none;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }
                .sidebar-tool-btn:hover {
                    background-color: #F3F4F6;
                    color: #111827;
                    transform: translateY(-1px);
                }
                .sidebar-tool-btn.active {
                    background-color: #18181B;
                    color: white;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                .sidebar-tool-btn.active:hover {
                    background-color: #09090B;
                    color: white;
                    transform: none;
                }
                
                /* Header Tooltip Styles */
                .header-tooltip-wrapper {
                    position: relative;
                    display: inline-flex;
                    overflow: visible !important;
                    z-index: 10001;
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
                    z-index: 10002;
                    overflow: visible !important;
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
                
                @media (max-width: 768px) {
                    .edit-header {
                        padding: 12px 16px !important;
                    }
                    .edit-logo-text {
                        font-size: 16px !important;
                    }
                    .edit-sidebar {
                        width: 160px !important;
                        min-width: 160px !important;
                    }
                    .edit-tool-grid {
                        grid-template-columns: repeat(3, 1fr) !important;
                        gap: 4px !important;
                    }
                    .edit-canvas-padding {
                        padding: 16px !important;
                    }
                }
                @media (max-width: 480px) {
                    .edit-header {
                        padding: 8px 12px !important;
                    }
                    .edit-actions {
                        gap: 4px !important;
                    }
                    .edit-btn-text {
                        display: none !important;
                    }
                    .edit-tool-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                    }
                }
            `}</style>
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', sans-serif",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <header
          className="edit-header"
          style={{
            background: "linear-gradient(to right, #fb923c, #ec4899, #a855f7)",
            padding: "16px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            color: "white",
            boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
            zIndex: 50,
            boxSizing: "border-box",
            overflow: "visible"
          }}
        >
          {/* Logo Section - Left */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                userSelect: "none"
              }}
            >
              {/* Icon */}
              <div
                style={{
                  position: "relative",
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#a855f7"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
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
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  lineHeight: 1
                }}
              >
                <span
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    letterSpacing: "-0.5px",
                    color: "white"
                  }}
                >
                  Full
                </span>
                <span
                  style={{
                    fontSize: "24px",
                    fontWeight: "700",
                    letterSpacing: "-0.5px",
                    color: "#a855f7"
                  }}
                >
                  Grab
                </span>
              </div>
            </div>
          </div>

          {/* Center Actions (Edit, Share, Delete) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              backdropFilter: "blur(10px)",
              backgroundColor: "rgba(255,255,255,0.1)",
              padding: "8px",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.2)",
              overflow: "visible"
            }}
          >
            <div className="header-tooltip-wrapper">
              <button
                disabled
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  padding: "8px",
                  cursor: "not-allowed",
                  borderRadius: "8px",
                  pointerEvents: "auto",
                  opacity: 0.5
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ pointerEvents: "none" }}
                >
                  <path d="m18.226 5.226-2.52-2.52A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-.351" />
                  <path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />
                </svg>
              </button>
              <span className="header-tooltip">Edit</span>
            </div>
            <div className="header-tooltip-wrapper">
              <button
                onClick={handleShare}
                disabled={isSharing}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  padding: "8px",
                  cursor: isSharing ? "wait" : "pointer",
                  borderRadius: "8px",
                  opacity: isSharing ? 0.5 : 1,
                  pointerEvents: isSharing ? "none" : "auto"
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ pointerEvents: "none" }}
                >
                  <path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
              </button>
              <span className="header-tooltip">Share with link</span>
            </div>
            <div className="header-tooltip-wrapper">
              <button
                onClick={handleDelete}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fca5a5",
                  padding: "8px",
                  cursor: "pointer",
                  borderRadius: "8px",
                  pointerEvents: "auto"
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ pointerEvents: "none" }}
                >
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

          {/* Undo/Redo/Save Buttons */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              backdropFilter: "blur(10px)",
              backgroundColor: "rgba(255,255,255,0.1)",
              padding: "8px",
              borderRadius: "16px",
              border: "1px solid rgba(255,255,255,0.2)",
              position: "relative",
              overflow: "visible"
            }}
          >
            <div className="header-tooltip-wrapper">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  padding: "8px",
                  cursor: historyIndex <= 0 ? "not-allowed" : "pointer",
                  borderRadius: "8px",
                  opacity: historyIndex <= 0 ? 0.4 : 1,
                  pointerEvents: historyIndex <= 0 ? "none" : "auto"
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: "none" }}
                >
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
              </button>
              <span className="header-tooltip">Undo</span>
            </div>
            <div className="header-tooltip-wrapper">
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  padding: "8px",
                  cursor: historyIndex >= history.length - 1 ? "not-allowed" : "pointer",
                  borderRadius: "8px",
                  opacity: historyIndex >= history.length - 1 ? 0.4 : 1,
                  pointerEvents: historyIndex >= history.length - 1 ? "none" : "auto"
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: "none" }}
                >
                  <path d="M21 7v6h-6" />
                  <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
                </svg>
              </button>
              <span className="header-tooltip">Redo</span>
            </div>
            <div
              style={{
                width: "1px",
                height: "16px",
                background: "rgba(255,255,255,0.3)"
              }}
            ></div>
            <div className="header-tooltip-wrapper">
              <button
                onClick={handleSave}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "white",
                  padding: "8px",
                  cursor: "pointer",
                  borderRadius: "8px",
                  pointerEvents: "auto"
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ pointerEvents: "none" }}
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
              </button>
              <span className="header-tooltip">Save changes</span>
            </div>
          </div>

          {/* Download Buttons */}
          <div
            className="edit-actions"
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              position: "relative",
              overflow: "visible"
            }}
          >
            <div className="header-tooltip-wrapper">
              <button
                onClick={handleDownloadPDF}
                style={{
                  padding: "8px 16px",
                  background: "rgba(255,255,255,0.2)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  borderRadius: "12px",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  backdropFilter: "blur(10px)",
                  transition: "all 0.2s ease",
                  flexShrink: 0
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
                <span className="edit-btn-text">PDF</span>
              </button>
              <span className="header-tooltip">Download as PDF</span>
            </div>
            <div className="header-tooltip-wrapper">
              <button
                onClick={handleDownloadPNG}
                style={{
                  padding: "8px 16px",
                  background: "white",
                  border: "none",
                  borderRadius: "12px",
                  color: "#a855f7",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
                  transition: "all 0.2s ease",
                  flexShrink: 0
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span className="edit-btn-text">PNG</span>
              </button>
              <span className="header-tooltip">Download as PNG</span>
            </div>
          </div>

          {/* User Info Widget */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "1px",
                height: "20px",
                background: "rgba(255,255,255,0.3)"
              }}
            />
            <UserInfoWidget />
          </div>
        </header>

        {/* Main Content */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden", height: 0 }}>
          {/* Slim Toolbar */}
          <aside
            style={{
              width: "72px",
              background: "#FFFFFF",
              borderRight: "1px solid #E5E7EB",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: "16px",
              gap: "12px",
              zIndex: 20,
              flexShrink: 0
            }}
          >
            {tools.map((tool) => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                title={tool.label}
                className={`sidebar-tool-btn ${activeTool === tool.id ? "active" : ""}`}
              >
                <div style={{ transform: "scale(1.1)" }}>{getToolIcon(tool.id)}</div>
              </button>
            ))}
          </aside>

          {/* Properties Panel (formerly Left Sidebar) */}
          <aside
            className="properties-panel"
            style={{
              width: "300px",
              background: "#FFFFFF",
              borderRight: "1px solid #e5e7eb",
              overflowY: "auto",
              flexShrink: 0,
              scrollbarWidth: "thin"
            }}
          >
            {/* Properties Panel Content */}
            <div style={{ padding: "20px", minHeight: "min-content" }}>
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#111827",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px"
                }}
              >
                {getToolIcon(activeTool, true)}
                <span>{tools.find((t) => t.id === activeTool)?.label} Properties</span>
              </h2>

              {/* Tool Specific Options */}
              {activeTool === "background" && (
                <>
                  {/* Background Toggle */}
                  <div
                    style={{
                      background: "white",
                      borderRadius: "12px",
                      padding: "14px 16px",
                      marginBottom: "16px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                      border: "1px solid #e5e7eb",
                      transition: "all 0.3s ease"
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px"
                        }}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={backgroundEnabled ? "#a855f7" : "#6b7280"}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: "#111827"
                          }}
                        >
                          Add Background
                        </span>
                      </div>
                      <button
                        onClick={() => setBackgroundEnabled(!backgroundEnabled)}
                        style={{
                          width: "44px",
                          height: "24px",
                          background: backgroundEnabled ? "#a855f7" : "#d1d5db",
                          border: "none",
                          borderRadius: "12px",
                          cursor: "pointer",
                          position: "relative",
                          transition: "all 0.3s ease",
                          flexShrink: 0
                        }}
                      >
                        <div
                          style={{
                            width: "18px",
                            height: "18px",
                            background: "white",
                            borderRadius: "9px",
                            position: "absolute",
                            top: "3px",
                            left: backgroundEnabled ? "23px" : "3px",
                            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Gradients */}
                  {backgroundEnabled && (
                    <div style={{ marginBottom: "16px" }}>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6b7280",
                          marginBottom: "8px"
                        }}
                      >
                        Gradients
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: "6px"
                        }}
                      >
                        {gradients.map((gradient, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedGradient(gradient)}
                            style={{
                              aspectRatio: "1",
                              background: gradient,
                              border: selectedGradient === gradient ? "2px solid #a855f7" : "none",
                              borderRadius: "8px",
                              cursor: "pointer",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Solid Colors */}
                  {backgroundEnabled && (
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6b7280",
                          marginBottom: "8px"
                        }}
                      >
                        Solid Colors
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: "6px"
                        }}
                      >
                        {solidColors.map((color, index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedColor(color)}
                            style={{
                              aspectRatio: "1",
                              background: color,
                              border:
                                selectedColor === color ? "2px solid #a855f7" : "1px solid #e5e7eb",
                              borderRadius: "8px",
                              cursor: "pointer"
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTool === "frame" && (
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#6b7280",
                      marginBottom: "8px"
                    }}
                  >
                    Frame Styles
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}
                  >
                    {["shadow", "border", "glow"].map((style) => {
                      const isActive = frameStyle === style;
                      return (
                        <button
                          key={style}
                          onClick={() => setFrameStyle(style)}
                          style={{
                            padding: "12px 14px",
                            background: isActive ? "#18181B" : "white",
                            color: isActive ? "white" : "#374151",
                            border: isActive ? "none" : "1px solid #e5e7eb",
                            borderRadius: "10px",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "13px",
                            textTransform: "capitalize",
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            transition: "all 0.2s",
                            boxShadow: isActive
                              ? "0 4px 12px rgba(0,0,0,0.2)"
                              : "0 1px 3px rgba(0,0,0,0.05)"
                          }}
                        >
                          {style === "shadow" && (
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="3" y="3" width="7" height="7" />
                              <rect x="14" y="3" width="7" height="7" />
                              <rect x="14" y="14" width="7" height="7" />
                              <rect x="3" y="14" width="7" height="7" />
                            </svg>
                          )}
                          {style === "border" && (
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            </svg>
                          )}
                          {style === "glow" && (
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                          )}
                          <span>
                            {style === "shadow"
                              ? "Drop Shadow"
                              : style === "border"
                                ? "Border"
                                : "Glow Effect"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTool === "resize" && (
                <div>
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#6b7280",
                        marginBottom: "8px"
                      }}
                    >
                      Image Scale: {imageSize}%
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      value={imageSize}
                      onChange={(e) => setImageSize(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "black" }}
                    />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#6b7280",
                        marginBottom: "8px"
                      }}
                    >
                      Padding: {paddingSize}px
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={paddingSize}
                      onChange={(e) => setPaddingSize(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "black" }}
                    />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#6b7280",
                        marginBottom: "8px"
                      }}
                    >
                      Corner Radius: {cornerRadius}px
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={cornerRadius}
                      onChange={(e) => setCornerRadius(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "black" }}
                    />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#6b7280",
                        marginBottom: "8px"
                      }}
                    >
                      Shadow: {shadowIntensity}px
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={shadowIntensity}
                      onChange={(e) => setShadowIntensity(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "black" }}
                    />
                  </div>
                </div>
              )}

              {activeTool === "text" && (
                <div>
                  <div
                    style={{
                      background: "white",
                      borderRadius: "12px",
                      padding: "12px",
                      marginBottom: "12px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#6b7280",
                        marginBottom: "8px"
                      }}
                    >
                      Add Text
                    </div>
                    <input
                      type="text"
                      placeholder="Enter text..."
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && handleAddText()}
                      style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                        fontSize: "13px",
                        marginBottom: "8px"
                      }}
                    />
                    <button
                      onClick={handleAddText}
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "#18181B",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      Add Text Overlay
                    </button>
                  </div>
                  {textOverlays.length > 0 && (
                    <div>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6b7280",
                          marginBottom: "8px"
                        }}
                      >
                        Text Overlays ({textOverlays.length})
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px"
                        }}
                      >
                        {textOverlays.map((overlay) => (
                          <div
                            key={overlay.id}
                            style={{
                              background: "white",
                              padding: "8px",
                              borderRadius: "6px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "12px"
                            }}
                          >
                            <span
                              style={{
                                flex: 1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap"
                              }}
                            >
                              {overlay.text}
                            </span>
                            <button
                              onClick={() => handleRemoveText(overlay.id)}
                              style={{
                                background: "#ef4444",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                padding: "4px 8px",
                                cursor: "pointer",
                                fontSize: "11px"
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedTextId && textOverlays.find((t) => t.id === selectedTextId) && (
                    <div
                      style={{
                        background: "white",
                        borderRadius: "12px",
                        padding: "12px",
                        marginTop: "12px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        border: "2px solid #a855f7"
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#a855f7",
                          marginBottom: "8px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <span>✏️</span> Edit Selected Text
                      </div>
                      <div style={{ marginBottom: "12px" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#6b7280",
                            marginBottom: "6px"
                          }}
                        >
                          Font Size: {textOverlays.find((t) => t.id === selectedTextId)?.fontSize}
                          px
                        </div>
                        <input
                          type="range"
                          min="12"
                          max="72"
                          value={textOverlays.find((t) => t.id === selectedTextId)?.fontSize || 24}
                          onChange={(e) => updateSelectedTextSize(e.target.value)}
                          style={{ width: "100%", accentColor: "#a855f7" }}
                        />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "11px",
                            color: "#6b7280",
                            marginBottom: "6px"
                          }}
                        >
                          Text Color
                        </div>
                        <input
                          type="color"
                          value={
                            textOverlays.find((t) => t.id === selectedTextId)?.color || "#ffffff"
                          }
                          onChange={(e) => updateSelectedTextColor(e.target.value)}
                          style={{
                            width: "100%",
                            height: "36px",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer"
                          }}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#9ca3af",
                          marginTop: "8px",
                          textAlign: "center"
                        }}
                      >
                        💡 Drag text on canvas to reposition
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTool === "shapes" && (
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#6b7280",
                      marginBottom: "8px"
                    }}
                  >
                    Add Shapes
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "8px",
                      marginBottom: "16px"
                    }}
                  >
                    {[
                      {
                        name: "Circle",
                        icon: (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                        )
                      },
                      {
                        name: "Square",
                        icon: (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                          </svg>
                        )
                      },
                      {
                        name: "Triangle",
                        icon: (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3 L22 21 L2 21 Z" />
                          </svg>
                        )
                      },
                      {
                        name: "Star",
                        icon: (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2 L15.09 8.26 L22 9.27 L17 14.14 L18.18 21.02 L12 17.77 L5.82 21.02 L7 14.14 L2 9.27 L8.91 8.26 Z" />
                          </svg>
                        )
                      },
                      {
                        name: "Heart",
                        icon: (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                          </svg>
                        )
                      },
                      {
                        name: "Arrow",
                        icon: (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
                          </svg>
                        )
                      }
                    ].map((shape) => (
                      <button
                        key={shape.name}
                        onClick={() => handleAddShape(shape.name)}
                        style={{
                          padding: "12px 8px",
                          background: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.2s",
                          color: "#374151"
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = "#18181B";
                          e.currentTarget.style.color = "white";
                          e.currentTarget.style.borderColor = "#18181B";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = "white";
                          e.currentTarget.style.color = "#374151";
                          e.currentTarget.style.borderColor = "#e5e7eb";
                        }}
                      >
                        <span>{shape.icon}</span>
                        <span style={{ fontSize: "10px", fontWeight: 600 }}>{shape.name}</span>
                      </button>
                    ))}
                  </div>
                  {shapes.length > 0 && (
                    <div style={{ marginBottom: "16px" }}>
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6b7280",
                          marginBottom: "8px"
                        }}
                      >
                        Layers ({shapes.length})
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px"
                        }}
                      >
                        {shapes.map((shape) => (
                          <div
                            key={shape.id}
                            style={{
                              background: "white",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: "1px solid #f3f4f6",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "12px"
                            }}
                          >
                            <span style={{ fontWeight: 500, color: "#374151" }}>{shape.type}</span>
                            <button
                              onClick={() => handleRemoveShape(shape.id)}
                              style={{
                                background: "transparent",
                                color: "#ef4444",
                                border: "none",
                                cursor: "pointer",
                                padding: "4px",
                                display: "flex",
                                alignItems: "center"
                              }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedShapeId && shapes.find((s) => s.id === selectedShapeId) && (
                    <div
                      style={{
                        background: "#FAFAFA",
                        borderRadius: "12px",
                        padding: "16px",
                        border: "1px solid #E5E7EB"
                      }}
                    >
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#111827",
                          marginBottom: "16px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px"
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        Edit Shape
                      </div>
                      <div style={{ marginBottom: "16px" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "#6b7280",
                            marginBottom: "8px"
                          }}
                        >
                          Size
                        </div>
                        <input
                          type="range"
                          min="20"
                          max="100"
                          value={shapes.find((s) => s.id === selectedShapeId)?.size || 50}
                          onChange={(e) => updateSelectedShapeSize(e.target.value)}
                          style={{ width: "100%", accentColor: "black" }}
                        />
                      </div>
                      <div style={{ marginBottom: "16px" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "#6b7280",
                            marginBottom: "8px"
                          }}
                        >
                          Color
                        </div>
                        <input
                          type="color"
                          value={shapes.find((s) => s.id === selectedShapeId)?.color || "#ffffff"}
                          onChange={(e) => updateSelectedShapeColor(e.target.value)}
                          style={{
                            width: "100%",
                            height: "36px",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            background: "transparent"
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: "16px" }}>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "#6b7280",
                            marginBottom: "8px"
                          }}
                        >
                          Rotation
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          value={shapes.find((s) => s.id === selectedShapeId)?.rotation || 0}
                          onChange={(e) => updateSelectedShapeRotation(e.target.value)}
                          style={{ width: "100%", accentColor: "black" }}
                        />
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "#6b7280",
                            marginBottom: "8px"
                          }}
                        >
                          Style
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => updateSelectedShapeStyle("filled")}
                            style={{
                              flex: 1,
                              padding: "8px",
                              background:
                                shapes.find((s) => s.id === selectedShapeId)?.style === "filled"
                                  ? "#18181B"
                                  : "white",
                              color:
                                shapes.find((s) => s.id === selectedShapeId)?.style === "filled"
                                  ? "white"
                                  : "#6b7280",
                              border:
                                shapes.find((s) => s.id === selectedShapeId)?.style === "filled"
                                  ? "none"
                                  : "1px solid #e5e7eb",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: 600,
                              transition: "all 0.2s"
                            }}
                          >
                            Filled
                          </button>
                          <button
                            onClick={() => updateSelectedShapeStyle("outline")}
                            style={{
                              flex: 1,
                              padding: "8px",
                              background:
                                shapes.find((s) => s.id === selectedShapeId)?.style === "outline"
                                  ? "#18181B"
                                  : "white",
                              color:
                                shapes.find((s) => s.id === selectedShapeId)?.style === "outline"
                                  ? "white"
                                  : "#6b7280",
                              border:
                                shapes.find((s) => s.id === selectedShapeId)?.style === "outline"
                                  ? "none"
                                  : "1px solid #e5e7eb",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "12px",
                              fontWeight: 600,
                              transition: "all 0.2s"
                            }}
                          >
                            Outline
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTool === "brush" && (
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#6b7280",
                      marginBottom: "8px"
                    }}
                  >
                    Brush Tools
                  </div>
                  <div
                    style={{
                      background: "white",
                      borderRadius: "12px",
                      padding: "12px",
                      marginBottom: "12px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                    }}
                  >
                    <div style={{ marginBottom: "12px" }}>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          marginBottom: "6px"
                        }}
                      >
                        Brush Size: {brushSize}px
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="50"
                        value={brushSize}
                        onChange={(e) => setBrushSize(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "black" }}
                      />
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          marginBottom: "6px"
                        }}
                      >
                        Opacity: {brushOpacity}%
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={brushOpacity}
                        onChange={(e) => setBrushOpacity(Number(e.target.value))}
                        style={{ width: "100%", accentColor: "black" }}
                      />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          marginBottom: "6px"
                        }}
                      >
                        Color
                      </div>
                      <input
                        type="color"
                        value={brushColor}
                        onChange={(e) => setBrushColor(e.target.value)}
                        style={{
                          width: "100%",
                          height: "36px",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDrawing(!isDrawing)}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: isDrawing ? "#ef4444" : "#18181B",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px"
                    }}
                  >
                    {isDrawing ? (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        </svg>
                        Stop Drawing
                      </>
                    ) : (
                      <>
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 19l7-7 3 3-7 7-3-3z" />
                          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                          <path d="M2 2l7.586 7.586" />
                          <circle cx="11" cy="11" r="2" />
                        </svg>
                        Start Drawing
                      </>
                    )}
                  </button>
                  {isDrawing && (
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "10px",
                        background: "#27272A",
                        borderRadius: "8px",
                        fontSize: "11px",
                        color: "white",
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 19l7-7 3 3-7 7-3-3z" />
                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                        <path d="M2 2l7.586 7.586" />
                        <circle cx="11" cy="11" r="2" />
                      </svg>
                      Draw on canvas
                    </div>
                  )}
                </div>
              )}

              {activeTool === "crop" && (
                <div>
                  {!isCropping ? (
                    <button
                      onClick={() => setIsCropping(true)}
                      style={{
                        width: "100%",
                        padding: "12px",
                        background: "#18181B",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: "13px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px"
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                        <path d="M18 22V8a2 2 0 0 0-2-2H2" />
                      </svg>
                      Start Cropping
                    </button>
                  ) : (
                    <>
                      <div
                        style={{
                          padding: "12px",
                          background: "#27272A",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "white",
                          textAlign: "center",
                          marginBottom: "12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          border: "1px solid #3F3F46"
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                          <polyline points="13 2 13 9 20 9"></polyline>
                        </svg>
                        Drag on image to select area
                      </div>
                      {cropRect && (
                        <button
                          onClick={() => {
                            // Create a canvas to crop the image
                            const img = new Image();
                            img.onload = () => {
                              const canvas = document.createElement("canvas");
                              const ctx = canvas.getContext("2d");

                              // Get the container element that crop percentages are relative to
                              const container = document.getElementById("edit-canvas");
                              const containerRect = container.getBoundingClientRect();

                              // Get the actual displayed image element
                              const displayedImg = document.querySelector('img[alt="Screenshot"]');
                              const imgRect = displayedImg.getBoundingClientRect();

                              // Calculate offset of image within container
                              const imgOffsetX = imgRect.left - containerRect.left;
                              const imgOffsetY = imgRect.top - containerRect.top;

                              // Convert crop percentages (relative to container) to pixels (relative to container)
                              const cropContainerX = (cropRect.left / 100) * containerRect.width;
                              const cropContainerY = (cropRect.top / 100) * containerRect.height;
                              const cropContainerWidth =
                                (cropRect.width / 100) * containerRect.width;
                              const cropContainerHeight =
                                (cropRect.height / 100) * containerRect.height;

                              // Adjust crop coordinates to be relative to image
                              const cropImgX = cropContainerX - imgOffsetX;
                              const cropImgY = cropContainerY - imgOffsetY;

                              // Scale to natural image size
                              const scaleX = img.naturalWidth / imgRect.width;
                              const scaleY = img.naturalHeight / imgRect.height;

                              const finalCropX = Math.max(0, cropImgX * scaleX);
                              const finalCropY = Math.max(0, cropImgY * scaleY);
                              const finalCropWidth = Math.min(
                                cropContainerWidth * scaleX,
                                img.naturalWidth - finalCropX
                              );
                              const finalCropHeight = Math.min(
                                cropContainerHeight * scaleY,
                                img.naturalHeight - finalCropY
                              );

                              // Set canvas to cropped size
                              canvas.width = finalCropWidth;
                              canvas.height = finalCropHeight;

                              // Draw the cropped portion
                              ctx.drawImage(
                                img,
                                finalCropX,
                                finalCropY,
                                finalCropWidth,
                                finalCropHeight,
                                0,
                                0,
                                finalCropWidth,
                                finalCropHeight
                              );

                              // Convert to data URL and update image
                              const croppedImage = canvas.toDataURL("image/png");
                              setImage(croppedImage);

                              // Reset size to 100% and clear overlays for cropped image
                              setImageSize(100);
                              setTextOverlays([]);
                              setShapes([]);
                              setDrawingPaths([]);

                              // Reset crop state
                              setIsCropping(false);
                              setCropStart(null);
                              setCropEnd(null);
                              setCropRect(null);
                            };
                            img.src = image;
                          }}
                          style={{
                            width: "100%",
                            padding: "12px",
                            background: "#10b981",
                            color: "white",
                            border: "none",
                            borderRadius: "8px",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "13px",
                            marginBottom: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "8px"
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          Apply Crop
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setIsCropping(false);
                          setCropStart(null);
                          setCropEnd(null);
                          setCropRect(null);
                        }}
                        style={{
                          width: "100%",
                          padding: "12px",
                          background: "white",
                          color: "#374151",
                          border: "1px solid #E5E7EB",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "13px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px"
                        }}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}

              {activeTool === "postout" && (
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: "16px"
                    }}
                  >
                    Share to Social Media
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}
                  >
                    <button
                      onClick={() => handlePostout("Twitter/X")}
                      style={{
                        padding: "12px 16px",
                        background: "black",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "13px",
                        fontWeight: 500
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>𝕏</span> Share on X (Twitter)
                    </button>
                    <button
                      onClick={() => handlePostout("LinkedIn")}
                      style={{
                        padding: "12px 16px",
                        background: "#0a66c2",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "13px",
                        fontWeight: 500
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>in</span> Share on LinkedIn
                    </button>
                    <button
                      onClick={() => handlePostout("Facebook")}
                      style={{
                        padding: "12px 16px",
                        background: "#1877f2",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "13px",
                        fontWeight: 500
                      }}
                    >
                      <span style={{ fontSize: "16px" }}>f</span> Share on Facebook
                    </button>
                    <button
                      onClick={() => handlePostout("Instagram")}
                      style={{
                        padding: "12px 16px",
                        background:
                          "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        fontSize: "13px",
                        fontWeight: 500
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                      </svg>
                      Share on Instagram
                    </button>
                    <div
                      style={{
                        marginTop: "12px",
                        padding: "12px",
                        background: "#F3F4F6",
                        borderRadius: "8px",
                        fontSize: "11px",
                        color: "#6B7280"
                      }}
                    >
                      Note: This will upload your edited image to a public URL and open the sharing
                      dialog.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Canvas Area */}
          <main
            className="edit-canvas-padding"
            style={{
              flex: 1,
              background: "#f3f4f6",
              backgroundImage: "radial-gradient(#d1d5db 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "center",
              padding: "40px",
              overflow: "auto",
              minWidth: 0,
              position: "relative"
            }}
          >
            {/* Zoom Controls */}
            <div
              style={{
                position: "fixed",
                bottom: "30px",
                right: "30px",
                display: "flex",
                alignItems: "center",
                background: "rgba(255, 255, 255, 0.95)",
                borderRadius: "30px",
                padding: "8px 16px",
                backdropFilter: "blur(10px)",
                gap: "12px",
                boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
                border: "1px solid rgba(255,255,255,0.4)",
                zIndex: 100
              }}
            >
              <button onClick={handleZoomOut} className="zoom-btn" title="Zoom Out">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>

              <span
                style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "#333",
                  minWidth: "45px",
                  textAlign: "center",
                  userSelect: "none"
                }}
              >
                {zoom}%
              </span>

              <button onClick={handleZoomIn} className="zoom-btn" title="Zoom In">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>

            <div
              style={{
                width: `${zoom}%`,
                minWidth: "200px",
                transition: "width 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
                margin: "auto"
              }}
            >
              <div
                id="edit-canvas"
                onMouseMove={(e) => {
                  handleTextMouseMove(e);
                  handleShapeMouseMove(e);
                  handleCanvasMouseMove(e);
                  handleCropMouseMove(e);
                }}
                onMouseUp={() => {
                  handleTextMouseUp();
                  handleShapeMouseUp();
                  handleCanvasMouseUp();
                  handleCropMouseUp();
                }}
                onMouseLeave={() => {
                  handleTextMouseUp();
                  handleShapeMouseUp();
                  handleCanvasMouseUp();
                  handleCropMouseUp();
                }}
                onMouseDown={(e) => {
                  handleCanvasMouseDown(e);
                  handleCropMouseDown(e);
                }}
                style={{
                  background: backgroundEnabled
                    ? selectedGradient ||
                      selectedColor ||
                      "linear-gradient(135deg, #FF6B6B 0%, #FFB88C 100%)"
                    : "#f9fafb",
                  borderRadius: "16px",
                  boxShadow:
                    "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 100px -20px rgba(0,0,0,0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.5)",
                  minWidth: "300px",
                  minHeight: "200px",
                  maxWidth: "90%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: `${paddingSize}px`,
                  position: "relative",
                  transition: "all 0.3s ease",
                  cursor: isDrawing
                    ? "crosshair"
                    : isCropping
                      ? "crosshair"
                      : draggingTextId || draggingShapeId
                        ? "grabbing"
                        : "default"
                }}
              >
                {image ? (
                  <>
                    <img
                      src={image}
                      alt="Screenshot"
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "100%",
                        borderRadius: `${cornerRadius}px`,
                        boxShadow:
                          frameStyle === "shadow"
                            ? `0 ${shadowIntensity}px ${shadowIntensity * 2}px rgba(0,0,0,0.3)`
                            : frameStyle === "glow"
                              ? `0 0 ${shadowIntensity}px ${shadowIntensity / 2}px rgba(168, 85, 247, 0.6)`
                              : `0 ${shadowIntensity / 2}px ${shadowIntensity}px rgba(0,0,0,0.15)`,
                        border: frameStyle === "border" ? "4px solid white" : "none",
                        transform: `scale(${imageSize / 100})`,
                        transition: "all 0.3s ease",
                        pointerEvents: "none",
                        userSelect: "none"
                      }}
                    />
                    {/* Text Overlays - Interactive with drag and selection */}
                    {textOverlays.map((overlay) => (
                      <div
                        key={overlay.id}
                        onMouseDown={(e) => handleTextMouseDown(e, overlay.id)}
                        style={{
                          position: "absolute",
                          left: `${overlay.x}%`,
                          top: `${overlay.y}%`,
                          transform: "translate(-50%, -50%)",
                          color: overlay.color,
                          fontSize: `${overlay.fontSize}px`,
                          fontWeight: "bold",
                          textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
                          pointerEvents: "auto",
                          cursor: draggingTextId === overlay.id ? "grabbing" : "grab",
                          whiteSpace: "nowrap",
                          userSelect: "none",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          border:
                            selectedTextId === overlay.id
                              ? "2px dashed rgba(168, 85, 247, 0.8)"
                              : "2px dashed transparent",
                          background:
                            selectedTextId === overlay.id
                              ? "rgba(168, 85, 247, 0.15)"
                              : "transparent",
                          transition: "border 0.2s, background 0.2s"
                        }}
                      >
                        {overlay.text}
                      </div>
                    ))}
                    {/* Shape Overlays - Interactive with drag and selection */}
                    {shapes.map((shape) => {
                      const shapeEmojis = {
                        Circle: "●",
                        Square: "■",
                        Triangle: "▲",
                        Star: "★",
                        Heart: "♥",
                        Arrow: "→"
                      };
                      const outlineEmojis = {
                        Circle: "○",
                        Square: "□",
                        Triangle: "△",
                        Star: "☆",
                        Heart: "♡",
                        Arrow: "→"
                      };

                      return (
                        <div
                          key={shape.id}
                          onMouseDown={(e) => handleShapeMouseDown(e, shape.id)}
                          style={{
                            position: "absolute",
                            left: `${shape.x}%`,
                            top: `${shape.y}%`,
                            transform: `translate(-50%, -50%) rotate(${shape.rotation || 0}deg)`,
                            fontSize: `${shape.size}px`,
                            color: shape.color,
                            pointerEvents: "auto",
                            cursor: draggingShapeId === shape.id ? "grabbing" : "grab",
                            userSelect: "none",
                            padding: "4px",
                            borderRadius: "4px",
                            border:
                              selectedShapeId === shape.id
                                ? "2px dashed rgba(168, 85, 247, 0.8)"
                                : "2px dashed transparent",
                            background:
                              selectedShapeId === shape.id
                                ? "rgba(168, 85, 247, 0.15)"
                                : "transparent",
                            transition: "border 0.2s, background 0.2s",
                            textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
                            lineHeight: 1
                          }}
                        >
                          {shape.style === "filled"
                            ? shapeEmojis[shape.type]
                            : outlineEmojis[shape.type]}
                        </div>
                      );
                    })}
                    {/* Drawing Canvas Overlay */}
                    <canvas
                      id="drawing-canvas"
                      width={800}
                      height={600}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        pointerEvents: isDrawing ? "auto" : "none",
                        cursor: isDrawing ? "crosshair" : "default"
                      }}
                    />
                    {/* Crop Overlay */}
                    {isCropping && cropRect && (
                      <div
                        style={{
                          position: "absolute",
                          left: `${cropRect.left}%`,
                          top: `${cropRect.top}%`,
                          width: `${cropRect.width}%`,
                          height: `${cropRect.height}%`,
                          border: "2px dashed #a855f7",
                          background: "rgba(168, 85, 247, 0.1)",
                          pointerEvents: "none",
                          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)"
                        }}
                      />
                    )}
                  </>
                ) : (
                  <div
                    style={{
                      background: "white",
                      borderRadius: "24px",
                      padding: "24px 48px",
                      boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                      display: "flex",
                      gap: "8px"
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        background: "#60a5fa",
                        borderRadius: "50%"
                      }}
                    />
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        background: "#34d399",
                        borderRadius: "50%"
                      }}
                    />
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        background: "#fbbf24",
                        borderRadius: "50%"
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Shared Link Display - Matching preview.jsx exactly */}
        {sharedLink && (
          <div
            style={{
              position: "fixed",
              bottom: "30px",
              right: "30px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              padding: "16px 20px",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(102, 126, 234, 0.4)",
              zIndex: 10000,
              minWidth: "320px",
              animation: "slideInRight 0.3s ease-out",
              overflow: "hidden"
            }}
          >
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
                    `}</style>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "10px"
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "15px",
                    marginBottom: "4px"
                  }}
                >
                  Link Generated!
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    opacity: 0.9,
                    wordBreak: "break-all"
                  }}
                >
                  {sharedLink}
                </div>
              </div>
            </div>

            <button
              onClick={handleCopyLink}
              style={{
                width: "100%",
                padding: "10px",
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "8px",
                color: "white",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: "14px",
                transition: "all 0.2s ease"
              }}
            >
              📋 Copy to close
            </button>
          </div>
        )}

        {/* Link Copied Toast - Matching preview.jsx */}
        {showToast && (
          <div
            style={{
              position: "fixed",
              bottom: "30px",
              right: "30px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              padding: "16px 20px",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(102, 126, 234, 0.4)",
              zIndex: 10000,
              minWidth: "320px",
              animation: "slideInRight 0.3s ease-out",
              overflow: "hidden"
            }}
          >
            <style>{`
                        @keyframes countdownBar {
                            from {
                                width: 100%;
                            }
                            to {
                                width: 0%;
                            }
                        }
                    `}</style>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "10px"
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>Link Copied!</div>
                <div style={{ fontSize: "13px", opacity: 0.9 }}>
                  Shareable link copied to clipboard
                </div>
              </div>
            </div>

            <div
              style={{
                height: "4px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "2px",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "white",
                  animation: "countdownBar 5s linear forwards"
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Save Success Toast */}
        {showSaveToast && (
          <div
            style={{
              position: "fixed",
              bottom: "30px",
              right: "30px",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "white",
              padding: "16px 20px",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(16, 185, 129, 0.4)",
              zIndex: 10000,
              minWidth: "320px",
              animation: "slideInRight 0.3s ease-out"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>Saved Successfully!</div>
                <div style={{ fontSize: "13px", opacity: 0.9 }}>Your changes have been saved</div>
              </div>
            </div>
          </div>
        )}

        {/* Download Success Toast - Matching preview.jsx */}
        {showDownloadToast && (
          <div
            style={{
              position: "fixed",
              bottom: "30px",
              right: "30px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              padding: "16px 20px",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(102, 126, 234, 0.4)",
              zIndex: 10000,
              minWidth: "320px",
              animation: "slideInRight 0.3s ease-out",
              overflow: "hidden"
            }}
          >
            <style>{`
                        @keyframes countdownBar {
                            from {
                                width: 100%;
                            }
                            to {
                                width: 0%;
                            }
                        }
                    `}</style>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "10px"
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  backgroundColor: "rgba(255,255,255,0.2)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>Downloaded Successfully!</div>
                <div style={{ fontSize: "13px", opacity: 0.9 }}>
                  Screenshot saved as {downloadFormat}
                </div>
              </div>
            </div>

            <div
              style={{
                height: "4px",
                background: "rgba(255,255,255,0.2)",
                borderRadius: "2px",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "white",
                  animation: "countdownBar 3s linear forwards"
                }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

const root = createRoot(document.getElementById("react-target"));
root.render(<EditPage />);
