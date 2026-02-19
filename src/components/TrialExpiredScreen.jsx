import React, { useEffect, useState } from "react";
import { authService } from "../services/authService";

const TrialExpiredScreen = ({ isPopup = false, isAuthenticated }) => {
  const handleAction = async () => {
    console.log("[TrialExpiredScreen] Action triggered, isAuthenticated:", isAuthenticated);
    try {
      if (isAuthenticated) {
        // User is signed in but no premium access -> Go to plans
        await authService.initiateUpgrade();
      } else {
        // User is not signed in -> High level sign in request
        await authService.initiateLogin();
      }
    } catch (err) {
      console.error("Failed to initiate auth action:", err);
      // Fallback to message passing if direct call fails
      try {
        await chrome.runtime.sendMessage({
          type: isAuthenticated ? "INITIATE_UPGRADE" : "INITIATE_LOGIN"
        });
      } catch (msgErr) {
        console.error("Fallback message passing also failed:", msgErr);
      }
    }
  };

  // Popup Variant (Compact)
  if (isPopup) {
    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
          zIndex: 9999, // High z-index to overlay everything
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "30px",
          textAlign: "center",
          fontFamily: "'Inter', sans-serif",
          boxSizing: "border-box",
          animation: "fadeIn 0.3s ease-out"
        }}
      >
        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        `}</style>

        <div
          style={{
            background: "white",
            borderRadius: "20px",
            padding: "32px 24px",
            width: "100%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            border: "1px solid rgba(0,0,0,0.05)",
            animation: "slideUp 0.4s ease-out"
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto",
              boxShadow: "0 4px 15px rgba(245, 158, 11, 0.3)"
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>

          <h2
            style={{
              fontSize: "20px",
              fontWeight: "800",
              color: "#111827",
              marginBottom: "10px",
              letterSpacing: "-0.5px"
            }}
          >
            Trial Expired
          </h2>

          <p
            style={{
              fontSize: "14px",
              color: "#6b7280",
              marginBottom: "24px",
              lineHeight: "1.5",
              padding: "0 10px"
            }}
          >
            {isAuthenticated
              ? "Your 20-day free trial has unfortunately ended. Upgrade to continue."
              : "Your free trial has ended. Sign in to activate your account."}
          </p>

          <button
            onClick={handleAction}
            style={{
              width: "100%",
              padding: "12px",
              background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "15px",
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(234, 88, 12, 0.25)",
              transition: "all 0.2s ease"
            }}
            onMouseOver={(e) => {
              e.target.style.transform = "translateY(-1px)";
              e.target.style.boxShadow = "0 6px 16px rgba(234, 88, 12, 0.35)";
            }}
            onMouseOut={(e) => {
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "0 4px 12px rgba(234, 88, 12, 0.25)";
            }}
          >
            {isAuthenticated ? "Upgrade Now" : "Sign In to Continue"}
          </button>
        </div>
      </div>
    );
  }

  // Full Page Variant (Preview/Main)
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', sans-serif"
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "24px",
          padding: "50px",
          width: "100%",
          maxWidth: "480px",
          textAlign: "center",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          animation: "scaleIn 0.3s ease-out"
        }}
      >
        <style>{`
          @keyframes scaleIn {
            from { transform: scale(0.95); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>

        <div
          style={{
            width: "80px",
            height: "80px",
            background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 30px auto",
            boxShadow: "0 10px 30px rgba(245, 158, 11, 0.3)"
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>

        <h1
          style={{
            fontSize: "28px",
            fontWeight: "800",
            color: "#111827",
            marginBottom: "12px",
            letterSpacing: "-0.5px"
          }}
        >
          Free Trial Expired
        </h1>

        <p
          style={{
            fontSize: "16px",
            color: "#6b7280",
            marginBottom: "40px",
            lineHeight: "1.6"
          }}
        >
          {isAuthenticated
            ? "Your 20-day free trial has unfortunately ended. To continue using FullGrab features, please upgrade to Premium."
            : "Your free trial has ended. Please sign in to verify your account status or upgrade to Premium."}
        </p>

        <button
          onClick={handleAction}
          style={{
            width: "100%",
            padding: "16px",
            background: "linear-gradient(135deg, #ea580c 0%, #c2410c 100%)",
            color: "white",
            border: "none",
            borderRadius: "12px",
            fontWeight: "700",
            fontSize: "16px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(234, 88, 12, 0.25)",
            transition: "all 0.2s ease",
            marginBottom: "16px"
          }}
          onMouseOver={(e) => {
            e.target.style.transform = "translateY(-2px)";
            e.target.style.boxShadow = "0 6px 20px rgba(234, 88, 12, 0.35)";
          }}
          onMouseOut={(e) => {
            e.target.style.transform = "translateY(0)";
            e.target.style.boxShadow = "0 4px 12px rgba(234, 88, 12, 0.25)";
          }}
        >
          {isAuthenticated ? "Upgrade to Premium" : "Sign In to Continue"}
        </button>

        <p style={{ fontSize: "12px", color: "#9ca3af" }}>Secure payment processing via Stripe</p>
      </div>
    </div>
  );
};

export default TrialExpiredScreen;
