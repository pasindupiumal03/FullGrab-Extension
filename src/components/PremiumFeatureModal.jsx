import React from "react";
import { authService } from "../services/authService";

const PremiumFeatureModal = ({ onClose }) => {
  const handleUpgrade = async () => {
    console.log("[PremiumFeatureModal] Upgrade triggered");
    try {
      await authService.initiateUpgrade();
      if (onClose) onClose();
    } catch (err) {
      console.error("Failed to initiate upgrade:", err);
      // Fallback to message passing
      try {
        await chrome.runtime.sendMessage({ type: "INITIATE_UPGRADE" });
        if (onClose) onClose();
      } catch (msgErr) {
        console.error("Fallback message passing also failed:", msgErr);
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif",
        animation: "fadeIn 0.2s ease-out"
      }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>

      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          padding: "40px",
          width: "100%",
          maxWidth: "420px",
          textAlign: "center",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          position: "relative",
          animation: "scaleIn 0.3s ease-out"
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "8px",
            borderRadius: "50%",
            color: "#9ca3af",
            transition: "all 0.2s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = "#f3f4f6";
            e.currentTarget.style.color = "#111827";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "#9ca3af";
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
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* Premium Icon */}
        <div
          style={{
            width: "72px",
            height: "72px",
            margin: "0 auto 24px auto",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 20px rgba(99, 102, 241, 0.3)"
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </div>

        <h3
          style={{
            fontSize: "24px",
            fontWeight: "800",
            color: "#111827",
            marginBottom: "12px",
            letterSpacing: "-0.5px"
          }}
        >
          Unlock Premium
        </h3>

        <p
          style={{
            fontSize: "15px",
            color: "#6b7280",
            marginBottom: "32px",
            lineHeight: "1.6"
          }}
        >
          This feature is available exclusively for Premium users. Upgrade now to remove limits and
          unlock all tools.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "20px",
            margin: "-20px"
          }}
        >
          <button
            onClick={handleUpgrade}
            style={{
              width: "100%",
              padding: "14px",
              background: "linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "16px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(79, 70, 229, 0.3)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease"
            }}
            onMouseOver={(e) => {
              e.target.style.transform = "translateY(-2px)";
              e.target.style.boxShadow = "0 6px 20px rgba(79, 70, 229, 0.4)";
            }}
            onMouseOut={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 4px 12px rgba(79, 70, 229, 0.3)";
            }}
          >
            Get Premium Access
          </button>

          <button
            onClick={onClose}
            style={{
              width: "100%",
              padding: "12px",
              background: "transparent",
              color: "#6b7280",
              border: "none",
              borderRadius: "12px",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              transition: "color 0.2s ease"
            }}
            onMouseOver={(e) => (e.target.style.color = "#111827")}
            onMouseOut={(e) => (e.target.style.color = "#6b7280")}
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default PremiumFeatureModal;
