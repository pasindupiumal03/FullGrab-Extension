import { HUB_URL, STORAGE_KEYS } from "../constants/config";

class AuthService {
  static STORAGE_KEY = STORAGE_KEYS.AUTH;
  static STATE_KEY = STORAGE_KEYS.AUTH_STATE;

  // Get stored access token
  async getAccessToken() {
    const result = await chrome.storage.local.get(AuthService.STORAGE_KEY);
    return result[AuthService.STORAGE_KEY]?.accessToken || null;
  }

  // Get stored refresh token
  async getRefreshToken() {
    const result = await chrome.storage.local.get(AuthService.STORAGE_KEY);
    return result[AuthService.STORAGE_KEY]?.refreshToken || null;
  }

  // Get stored user information
  async getUser() {
    const result = await chrome.storage.local.get(AuthService.STORAGE_KEY);
    return result[AuthService.STORAGE_KEY]?.user || null;
  }

  // Check if user is authenticated
  async isAuthenticated() {
    const token = await this.getAccessToken();
    return !!token;
  }

  // Store authentication data
  async storeAuth(accessToken, refreshToken, user) {
    await chrome.storage.local.set({
      [AuthService.STORAGE_KEY]: { accessToken, refreshToken, user },
    });
  }

  // Clear authentication data (logout)
  async logout() {
    console.log("[AuthService] Logging out...");
    try {
      const refreshToken = await this.getRefreshToken();
      if (refreshToken) {
        await fetch(`${HUB_URL}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (e) {
      console.error("Logout API call failed", e);
    } finally {
      await chrome.storage.local.remove(AuthService.STORAGE_KEY);
    }
  }

  // Generate random state for CSRF protection
  generateState() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Initiate login flow - redirects to Hub
  async initiateLogin(returnTo = "/fullgrab") {
    const state = this.generateState();

    await chrome.storage.local.set({
      [AuthService.STATE_KEY]: state,
    });

    const extensionId = chrome.runtime.id;
    const callbackUrl = `chrome-extension://${extensionId}/auth-callback.html`;

    const loginUrl = new URL(`${HUB_URL}/auth/extension`);
    loginUrl.searchParams.set("returnUrl", callbackUrl);
    loginUrl.searchParams.set("state", state);

    console.log("AuthService: Initiating login", loginUrl.toString());
    await chrome.tabs.create({ url: loginUrl.toString() });
  }

  // Initiate signup flow
  async initiateSignup(returnTo = "/fullgrab") {
    const state = this.generateState();

    await chrome.storage.local.set({
      [AuthService.STATE_KEY]: state,
    });

    const extensionId = chrome.runtime.id;
    const callbackUrl = `chrome-extension://${extensionId}/auth-callback.html`;

    const signupUrl = new URL(`${HUB_URL}/signup`);
    signupUrl.searchParams.set("returnUrl", callbackUrl);
    signupUrl.searchParams.set("state", state);
    signupUrl.searchParams.set("returnTo", returnTo);

    await chrome.tabs.create({ url: signupUrl.toString() });
  }

  // Initiate upgrade flow - redirects to Hub pricing
  async initiateUpgrade() {
    const state = this.generateState();

    await chrome.storage.local.set({
      [AuthService.STATE_KEY]: state,
    });

    const extensionId = chrome.runtime.id;
    const callbackUrl = `chrome-extension://${extensionId}/auth-callback.html?state=${state}`;

    const upgradeUrl = new URL(`${HUB_URL}/plans`);
    upgradeUrl.searchParams.set("returnUrl", callbackUrl);
    upgradeUrl.searchParams.set("appId", "fullgrab");

    await chrome.tabs.create({ url: upgradeUrl.toString() });
  }

  // Handle authentication callback from Hub
  async handleCallback(urlString) {
    try {
      const url = new URL(urlString);
      const accessToken = url.searchParams.get("accessToken");
      const refreshToken = url.searchParams.get("refreshToken");
      const state = url.searchParams.get("state");
      const returnTo = url.searchParams.get("returnTo") || "/fullgrab";

      // Validate parameters
      if (!accessToken || !refreshToken || !state) {
        return { success: false, error: "Missing tokens or state" };
      }

      // Verify state matches
      const result = await chrome.storage.local.get(AuthService.STATE_KEY);
      const storedState = result[AuthService.STATE_KEY];

      if (state !== storedState) {
        return {
          success: false,
          error: "Invalid state - possible CSRF attempt",
        };
      }

      // Validate token with Hub
      const validateResponse = await fetch(`${HUB_URL}/api/auth/validate`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!validateResponse.ok) {
        return { success: false, error: "Token validation failed" };
      }

      const { user } = await validateResponse.json();

      // Store auth data
      await this.storeAuth(accessToken, refreshToken, user);

      // Clean up state
      await chrome.storage.local.remove(AuthService.STATE_KEY);

      return { success: true, returnTo };
    } catch (error) {
      console.error("Auth callback error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Open Hub dashboard
  async openDashboard() {
    const dashboardUrl = `${HUB_URL}/account`;
    await chrome.tabs.create({ url: dashboardUrl });
  }

  // Refresh session using refresh token
  async refreshSession() {
    try {
      const refreshToken = await this.getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${HUB_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        const user = await this.getUser();
        if (user) {
          await this.storeAuth(data.accessToken, data.refreshToken, user);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error("Refresh session error:", error);
      return false;
    }
  }

  // Fetch with automatic token handling and refresh
  async fetchWithAuth(url, options = {}) {
    const accessToken = await this.getAccessToken();
    const headers = new Headers(options.headers);

    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      const refreshed = await this.refreshSession();
      if (refreshed) {
        const newAccessToken = await this.getAccessToken();
        headers.set("Authorization", `Bearer ${newAccessToken}`);
        return fetch(url, { ...options, headers });
      } else {
        await this.logout();
      }
    }

    return response;
  }
}

export const authService = new AuthService();
