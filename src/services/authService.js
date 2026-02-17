import { HUB_URL, STORAGE_KEYS } from "../constants/config";

class AuthService {
  // Get stored access token
  async getAccessToken() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH);
    return result[STORAGE_KEYS.AUTH]?.accessToken || null;
  }

  // Get stored refresh token
  async getRefreshToken() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH);
    return result[STORAGE_KEYS.AUTH]?.refreshToken || null;
  }

  // Get stored user information
  async getUser() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH);
    return result[STORAGE_KEYS.AUTH]?.user || null;
  }

  // Check if user is authenticated
  async isAuthenticated() {
    const token = await this.getAccessToken();
    return !!token;
  }

  // Store authentication data
  async storeAuth(accessToken, refreshToken, user) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTH]: { accessToken, refreshToken, user },
    });
  }

  // Clear authentication data (logout)
  async logout() {
    try {
      const refreshToken = await this.getRefreshToken();
      if (refreshToken) {
        // notify backend to remove refresh token
        await fetch(`${HUB_URL}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (e) {
      console.error("Logout API call failed", e);
    } finally {
      await chrome.storage.local.remove(STORAGE_KEYS.AUTH);
    }
  }

  // Generate random state for CSRF protection
  generateState() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  // Initiate login flow - redirects to Hub
  async initiateLogin(returnTo = "/fullgrab") {
    const state = this.generateState();

    // Store state for validation on callback
    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTH_STATE]: state,
    });

    // Get extension ID for callback URL
    const extensionId = chrome.runtime.id;
    const callbackUrl = `chrome-extension://${extensionId}/auth-callback.html`;

    // Build login URL with return parameters
    const loginUrl = new URL(`${HUB_URL}/auth/extension`);
    loginUrl.searchParams.set("returnUrl", callbackUrl);
    loginUrl.searchParams.set("state", state);
    if (returnTo) {
      // We can pass this through if we want deep linking support later
    }

    // Open Hub login in new tab
    await chrome.tabs.create({ url: loginUrl.toString() });
  }

  // Initiate signup flow - redirects to Hub
  async initiateSignup(returnTo = "/fullgrab") {
    const state = this.generateState();

    await chrome.storage.local.set({
      [STORAGE_KEYS.AUTH_STATE]: state,
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
      [STORAGE_KEYS.AUTH_STATE]: state,
    });

    const extensionId = chrome.runtime.id;
    // Embed state in the callback URL so it survives the payment flow
    const callbackUrl = `chrome-extension://${extensionId}/auth-callback.html?state=${state}`;

    const upgradeUrl = new URL(`${HUB_URL}/plans`);
    upgradeUrl.searchParams.set("returnUrl", callbackUrl);

    // Pass app ID to pre-select the correct plan/app context
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

      // Verify state matches (CSRF protection)
      const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH_STATE);
      const storedState = result[STORAGE_KEYS.AUTH_STATE];

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
      await chrome.storage.local.remove(STORAGE_KEYS.AUTH_STATE);

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
      console.error("Refresh session failed", error);
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
      // Try refresh
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
