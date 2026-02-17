import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { authService } from "./services/authService";
import "./index.css";

const AuthCallback = () => {
  const [status, setStatus] = useState("loading"); // loading, success, error
  const [error, setError] = useState("");

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const params = new URLSearchParams(window.location.search);

    // Handle Payment Success
    if (params.get("payment_success") === "true") {
      try {
        await chrome.runtime.sendMessage({ type: "PAYMENT_SUCCESS" });
        setStatus("success");
        setTimeout(() => window.close(), 2000);
      } catch (e) {
        console.error("Failed to notify background", e);
        setStatus("success");
        setTimeout(() => window.close(), 2000);
      }
      return;
    }

    // Handle Auth Callback
    const result = await authService.handleCallback(window.location.href);

    if (result.success) {
      try {
        await chrome.runtime.sendMessage({ type: "PAYMENT_SUCCESS" });
      } catch (e) {
        console.error("Failed to notify background", e);
      }
      setStatus("success");
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      setStatus("error");
      setError(result.error || "Authentication failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 p-4 font-sans text-neutral-900">
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl p-8 max-w-sm w-full text-center border border-neutral-200 dark:border-neutral-700">
        {status === "loading" && (
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Authenticating...
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400">
              Please wait while we verify your account.
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 mx-auto">
              <svg
                className="w-8 h-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
              Success!
            </h2>
            <p className="text-neutral-500 dark:text-neutral-400">
              You can now close this window.
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 mx-auto">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
              Authentication Failed
            </h2>
            <p className="text-red-500 dark:text-red-400 mb-6 text-sm">
              {error}
            </p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors font-medium"
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("react-target"));
root.render(<AuthCallback />);
