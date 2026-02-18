import { authService } from "./authService";
import {
  HUB_URL,
  APP_ID,
  ENTITLEMENT_CACHE_TTL,
  STORAGE_KEYS,
  TRIAL_DURATION_DAYS,
} from "../constants/config";

class EntitlementService {
  static CACHE_KEY = STORAGE_KEYS.ENTITLEMENT_CACHE;

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
      // Update last used on service initialization
      await chrome.storage.local.set({
        [STORAGE_KEYS.LAST_USED]: Date.now(),
      });
    }
  }

  // Check if the user has access (Premium OR Trial Active)
  async hasAccess() {
    // 1. Check Premium
    const isPremium = await this.checkPremium();
    if (isPremium) return true;

    // 2. Check Trial
    const isTrialValid = await this.checkTrialStatus();
    return isTrialValid;
  }

  // Check if trial is still valid
  async checkTrialStatus() {
    const data = await chrome.storage.local.get([STORAGE_KEYS.TRIAL_START]);
    const startDate = data[STORAGE_KEYS.TRIAL_START];

    if (!startDate) {
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

  // Check if user has premium access
  async checkPremium() {
    try {
      const isAuth = await authService.isAuthenticated();
      if (!isAuth) {
        console.log("[Entitlement] User not authenticated, free tier.");
        return false;
      }

      // Check cache first
      const cached = await this.getCache();
      if (cached && this.isCacheValid(cached)) {
        return cached.isPremium;
      }

      console.log(
        "[Entitlement] Cache expired or missing, fetching from API..."
      );
      // Fetch from API
      const isPremium = await this.fetchPremiumStatus();

      // Update cache
      await this.setCache(isPremium);

      return isPremium;
    } catch (error) {
      console.error("[Entitlement] Premium check failed:", error);
      return false;
    }
  }

  // Fetch status from API
  async fetchPremiumStatus() {
    const response = await authService.fetchWithAuth(
      `${HUB_URL}/api/entitlements?appId=${APP_ID}`
    );

    if (!response.ok) {
      if (response.status === 401) return false;
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.isPremium || false;
  }

  // Get cached entitlement from cookies
  async getCache() {
    try {
      const cookie = await chrome.cookies.get({
        url: HUB_URL,
        name: EntitlementService.CACHE_KEY,
      });

      if (!cookie) return null;

      return JSON.parse(decodeURIComponent(cookie.value));
    } catch (e) {
      console.error("Failed to read entitlement cookie", e);
      return null;
    }
  }

  // Check if cache is still valid
  isCacheValid(cache) {
    const isValid = Date.now() - cache.timestamp < ENTITLEMENT_CACHE_TTL;
    console.log(
      "[Entitlement] Is cache valid?",
      isValid,
      "(Age:",
      Math.round((Date.now() - cache.timestamp) / 1000),
      "s)"
    );
    return isValid;
  }

  // Update cached entitlement data in cookies
  async setCache(isPremium) {
    const value = JSON.stringify({
      isPremium,
      timestamp: Date.now(),
    });

    await chrome.cookies.set({
      url: HUB_URL,
      name: EntitlementService.CACHE_KEY,
      value: encodeURIComponent(value),
      expirationDate: (Date.now() + ENTITLEMENT_CACHE_TTL) / 1000,
      path: "/",
      sameSite: "lax",
      secure: HUB_URL.startsWith("https"),
    });
  }

  // Clear cached data (call on logout)
  async clearCache() {
    await chrome.cookies.remove({
      url: HUB_URL,
      name: EntitlementService.CACHE_KEY,
    });
  }

  // Force refresh premium status (bypasses cache)
  async refresh() {
    await this.clearCache();
    return this.checkPremium();
  }
}

export const entitlementService = new EntitlementService();
