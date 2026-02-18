import { entitlementService } from "../services/entitlementService";

/**
 * Check if user has premium access
 * @returns Promise<boolean> - true if premium, false if free
 */
export async function isPremiumUser() {
  return await entitlementService.checkPremium();
}

/**
 * Check if user has access to features (Premium OR Trial)
 * @returns Promise<boolean>
 */
export async function hasAccess() {
  return await entitlementService.hasAccess();
}

/**
 * Force refresh access status (bypass cache)
 * @returns Promise<boolean>
 */
export async function forceRefresh() {
  return await entitlementService.refresh();
}
