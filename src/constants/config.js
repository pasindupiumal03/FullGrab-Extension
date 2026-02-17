export const HUB_URL = "http://localhost:3000"; // Use localhost for dev, update for prod
export const APP_ID = "fullgrab";
export const TRIAL_DURATION_DAYS = 20;
export const ENTITLEMENT_CACHE_TTL = 120000; // 2 minutes

export const STORAGE_KEYS = {
  AUTH: "fullgrab_auth",
  AUTH_STATE: "fullgrab_auth_state",
  ENTITLEMENT_CACHE: "fullgrab_entitlement_cache",
  TRIAL_START: "fullgrab_install_date",
  LAST_USED: "fullgrab_last_used",
};
