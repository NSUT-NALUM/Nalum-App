/**
 * auth Constants
 *
 * Module-level constants and configuration values.
 *
 * Responsibilities:
 * - Store immutable values used by the module.
 * - Keep magic values centralized.
 * - Share well-known labels, keys, and defaults.
 *
 * Do NOT:
 * - Put runtime logic here.
 * - Store mutable state here.
 * - Duplicate values already defined in shared packages.
 */
export const OTP_LENGTH = 6;

export const OTP_EXPIRY_MINUTES = 10;

export const ACCESS_TOKEN_EXPIRY = "15m";

export const REFRESH_TOKEN_EXPIRY = "30d";

export const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

export const REFRESH_TOKEN_COOKIE_PATH = "/api/auth";

export const DEVICE_ID_COOKIE_NAME = "deviceId";

export const DEVICE_ID_COOKIE_PATH = "/";

export const GOOGLE_SIGNUP_ROLE_COOKIE_NAME = "googleSignupRole";

export const REFRESH_TOKEN_TTL_DAYS = 30;
