import { authService } from "./authService";
import {
  HUB_URL,
  APP_ID,
  ENTITLEMENT_CACHE_TTL,
  STORAGE_KEYS,
  TRIAL_DURATION_DAYS,
} from "../constants/config";

class EntitlementService {
  constructor() {
    this.initTrial();
  }

  // Initialize trial if not already set
  async initTrial() {
    const data = await chrome.storage.local.get([STORAGE_KEYS.TRIAL_START]);
    if (!data[STORAGE_KEYS.TRIAL_START]) {
      await chrome.storage.local.set({
        [STORAGE_KEYS.TRIAL_START]: Date.now(),
        [STORAGE_KEYS.LAST_USED]: Date.now(),
      });
    } else {
      // Update last used on service initialization (app startup)
      await chrome.storage.local.set({
        [STORAGE_KEYS.LAST_USED]: Date.now(),
      });
    }
  }

  // Check if the user has access (Premium OR Trial Active)
  async hasAccess() {
    console.log("[Entitlement] Checking access...");

    // 1. Check Premium
    const isPremium = await this.checkPremium();
    console.log("[Entitlement] isPremium:", isPremium);
    if (isPremium) return true;

    // 2. Check Trial
    const isTrialValid = await this.checkTrialStatus();
    console.log("[Entitlement] isTrialValid:", isTrialValid);
    return isTrialValid;
  }

  // Check if trial is still valid
  async checkTrialStatus() {
    const data = await chrome.storage.local.get([STORAGE_KEYS.TRIAL_START]);
    const startDate = data[STORAGE_KEYS.TRIAL_START];
    console.log("[Entitlement] Trial Start Date form storage:", startDate);
    console.log("[Entitlement] Current Date:", Date.now());

    if (!startDate) {
      console.log("[Entitlement] No start date, initializing...");
      // Should have been initialized, but safe fallback
      await this.initTrial();
      return true;
    }

    const now = Date.now();
    const diffTime = Math.abs(now - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    console.log(
      `[Entitlement] Trial status: ${diffDays} days used / ${TRIAL_DURATION_DAYS} allowed`
    );

    return diffDays <= TRIAL_DURATION_DAYS;
  }

  // Get trial details for UI
  async getTrialDetails() {
    const data = await chrome.storage.local.get([STORAGE_KEYS.TRIAL_START]);
    const startDate = data[STORAGE_KEYS.TRIAL_START] || Date.now();
    const now = Date.now();
    const diffTime = Math.abs(now - startDate);
    const daysUsed = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, TRIAL_DURATION_DAYS - daysUsed);

    return {
      startDate,
      daysUsed,
      daysLeft,
      totalDays: TRIAL_DURATION_DAYS,
      isExpired: daysUsed > TRIAL_DURATION_DAYS,
    };
  }

  // Check if user has premium access (cached or API)
  async checkPremium() {
    try {
      // Check if user is authenticated
      const isAuth = await authService.isAuthenticated();
      if (!isAuth) {
        return false; // Not logged in = not premium
      }

      // Check cache first
      const cached = await this.getCache();
      if (cached && this.isCacheValid(cached)) {
        return cached.isPremium;
      }

      // Fetch from API
      const isPremium = await this.fetchPremiumStatus();

      // Update cache
      await this.setCache(isPremium);

      return isPremium;
    } catch (error) {
      console.error("Premium check failed:", error);
      return false; // Fallback to free tier on error
    }
  }

  // Fetch premium status from Hub API
  async fetchPremiumStatus() {
    const response = await authService.fetchWithAuth(
      `${HUB_URL}/api/entitlements?appId=${APP_ID}`
    );

    if (!response.ok) {
      // If 401, token might be expired or invalid, handle gracefully
      if (response.status === 401) return false;
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.isPremium || false;
  }

  // Get cached entitlement data from cookies
  async getCache() {
    try {
      const cookie = await chrome.cookies.get({
        url: HUB_URL,
        name: STORAGE_KEYS.ENTITLEMENT_CACHE,
      });

      if (!cookie) return null;

      // Parse the cookie value
      const cache = JSON.parse(decodeURIComponent(cookie.value));
      return cache;
    } catch (e) {
      console.error("Failed to read entitlement cookie", e);
      return null;
    }
  }

  // Check if cache is still valid
  isCacheValid(cache) {
    return Date.now() - cache.timestamp < ENTITLEMENT_CACHE_TTL;
  }

  // Update cached entitlement data in cookies
  async setCache(isPremium) {
    const value = JSON.stringify({
      isPremium,
      timestamp: Date.now(),
    });

    await chrome.cookies.set({
      url: HUB_URL,
      name: STORAGE_KEYS.ENTITLEMENT_CACHE,
      value: encodeURIComponent(value),
      expirationDate: (Date.now() + ENTITLEMENT_CACHE_TTL) / 1000, // Unix timestamp in seconds
      path: "/",
      sameSite: "lax",
      secure: HUB_URL.startsWith("https"),
    });
  }

  // Clear cached data (call on logout)
  async clearCache() {
    await chrome.cookies.remove({
      url: HUB_URL,
      name: STORAGE_KEYS.ENTITLEMENT_CACHE,
    });
  }

  // Force refresh premium status (bypasses cache)
  async refresh() {
    await this.clearCache();
    // Also init trial to be safe
    await this.initTrial();
    return this.checkPremium();
  }
}

export const entitlementService = new EntitlementService();
