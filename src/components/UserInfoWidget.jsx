import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { authService } from "../services/authService";
import { entitlementService } from "../services/entitlementService";

/**
 * UserInfoWidget
 * Drop-in auth widget for FullGrab's top bar (preview & edit screens).
 * Matches the gradient header's glassmorphism design language.
 *
 * Features:
 * - Internal divider (escapes "dangling pipe" visual glitch)
 * - Pulsing skeleton loading state
 * - Dropdown rendered via React Portal
 */
const UserInfoWidget = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [menuHovered, setMenuHovered] = useState(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 });

  const btnRef = useRef(null); // trigger button
  const dropdownRef = useRef(null); // portal dropdown div

  // ── Auth state ─────────────────────────────────────────────────────────────
  const loadAuthState = useCallback(async () => {
    try {
      const authed = await authService.isAuthenticated();
      setIsAuthenticated(authed);
      if (authed) {
        const userData = await authService.getUser();
        setUser(userData);
        const premium = await entitlementService.checkPremium();
        setIsPremium(premium);
      } else {
        setUser(null);
        setIsPremium(false);
      }
    } catch (e) {
      console.error("[UserInfoWidget] Failed to load auth state:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuthState();
    const handleStorageChange = (changes, area) => {
      if (area === "local" && changes["fullgrab_auth"]) loadAuthState();
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [loadAuthState]);

  // ── Animated close helper ─────────────────────────────────────────────────
  const closeMenu = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setShowMenu(false);
      setIsClosing(false);
    }, 160);
  }, []);

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e) => {
      const clickedBtn = btnRef.current && btnRef.current.contains(e.target);
      const clickedDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);
      if (!clickedBtn && !clickedDropdown) closeMenu();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu, closeMenu]);

  // ── Compute dropdown position from trigger button ──────────────────────────
  const openMenu = () => {
    if (showMenu) {
      closeMenu();
      return;
    }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      });
    }
    setIsClosing(false);
    setShowMenu(true);
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    closeMenu();
    await entitlementService.clearCache();
    await authService.logout();
    setIsAuthenticated(false);
    setUser(null);
    setIsPremium(false);
  };

  const handleDashboard = () => {
    closeMenu();
    authService.openDashboard();
  };
  const handleUpgrade = () => {
    closeMenu();
    authService.initiateUpgrade();
  };

  // ── Styles ─────────────────────────────────────────────────────────────────
  const signInBtnStyle = {
    padding: "8px 18px",
    background: "rgba(255,255,255,0.2)",
    border: "1px solid rgba(255,255,255,0.45)",
    borderRadius: "10px",
    color: "white",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    backdropFilter: "blur(10px)",
    transition: "all 0.2s ease",
    fontFamily: "'Inter', sans-serif",
    letterSpacing: "0.3px",
    display: "flex",
    alignItems: "center",
    gap: "6px"
  };

  const userBtnStyle = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "7px 12px",
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: "10px",
    color: "white",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    backdropFilter: "blur(10px)",
    transition: "all 0.2s ease",
    fontFamily: "'Inter', sans-serif"
  };

  const dropdownStyle = {
    position: "fixed",
    top: `${dropdownPos.top}px`,
    right: `${dropdownPos.right}px`,
    minWidth: "220px",
    background: "white",
    borderRadius: "16px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.1)",
    border: "1px solid rgba(0,0,0,0.06)",
    overflow: "hidden",
    zIndex: 2147483647,
    animation: isClosing ? "fgUserMenuOut 0.16s ease-in forwards" : "fgUserMenuIn 0.18s ease-out",
    fontFamily: "'Inter', sans-serif"
  };

  const menuItemBase = {
    width: "100%",
    textAlign: "left",
    padding: "10px 16px",
    border: "none",
    background: "transparent",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    transition: "background 0.15s ease",
    fontFamily: "'Inter', sans-serif"
  };

  const getItemStyle = (key, color = "#111827", hoverBg = "#f3f4f6") => ({
    ...menuItemBase,
    color,
    background: menuHovered === key ? hoverBg : "transparent"
  });

  const skeletonStyle = {
    width: "100px",
    height: "32px",
    background: "rgba(255,255,255,0.2)",
    borderRadius: "10px",
    animation: "fgPulse 1.5s ease-in-out infinite",
    backdropFilter: "blur(4px)"
  };

  // ── Render Helpers ─────────────────────────────────────────────────────────

  const renderDropdown = () => {
    if (!isAuthenticated || !showMenu) return null;
    const displayName = user?.name || user?.email?.split("@")[0] || "Account";

    return ReactDOM.createPortal(
      <div ref={dropdownRef} style={dropdownStyle}>
        {/* Email header */}
        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #f3f4f6" }}>
          <div
            style={{
              fontSize: "11px",
              color: "#9ca3af",
              fontWeight: "600",
              marginBottom: "2px",
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}
          >
            Signed in as
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "#374151",
              fontWeight: "600",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {user?.email || displayName}
          </div>
          {isPremium && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                marginTop: "6px",
                padding: "2px 8px",
                background: "linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)",
                borderRadius: "20px",
                fontSize: "10px",
                fontWeight: "700",
                color: "white",
                letterSpacing: "0.3px"
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Premium
            </div>
          )}
        </div>

        {/* Menu items */}
        <div style={{ padding: "6px" }}>
          <button
            style={getItemStyle("dashboard", "#374151", "#f9fafb")}
            onMouseEnter={() => setMenuHovered("dashboard")}
            onMouseLeave={() => setMenuHovered(null)}
            onClick={handleDashboard}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "#6b7280" }}
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Dashboard
          </button>

          {!isPremium && (
            <button
              style={{
                ...getItemStyle("upgrade", "#7c3aed", "rgba(124,58,237,0.06)"),
                fontWeight: "700"
              }}
              onMouseEnter={() => setMenuHovered("upgrade")}
              onMouseLeave={() => setMenuHovered(null)}
              onClick={handleUpgrade}
            >
              <div
                style={{
                  width: "15px",
                  height: "15px",
                  borderRadius: "4px",
                  background: "linear-gradient(135deg, #4f46e5 0%, #9333ea 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="white" stroke="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              Upgrade to Premium
            </button>
          )}

          <div style={{ height: "1px", background: "#f3f4f6", margin: "4px 0" }} />

          <button
            style={getItemStyle("logout", "#ef4444", "rgba(239,68,68,0.06)")}
            onMouseEnter={() => setMenuHovered("logout")}
            onMouseLeave={() => setMenuHovered(null)}
            onClick={handleLogout}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </div>,
      document.body
    );
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "Account";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <style>{`
        @keyframes fgUserMenuIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fgUserMenuOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-6px) scale(0.97); }
        }
        @keyframes fgPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.15; }
        }
      `}</style>

      {/* Loading State: Pulsing Skeleton */}
      {loading && <div style={skeletonStyle} />}

      {/* Loaded State: Auth Buttons */}
      {!loading && !isAuthenticated && (
        <button
          style={signInBtnStyle}
          onClick={() => authService.initiateLogin()}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.32)";
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.2)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Sign In
        </button>
      )}

      {!loading && isAuthenticated && (
        <button
          ref={btnRef}
          style={userBtnStyle}
          onClick={openMenu}
          onMouseOver={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.28)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.15)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span
            style={{
              maxWidth: "120px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap"
            }}
          >
            {displayName}
          </span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: "transform 0.2s ease",
              transform: showMenu ? "rotate(180deg)" : "rotate(0deg)",
              flexShrink: 0
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}

      {renderDropdown()}
    </div>
  );
};

export default UserInfoWidget;
