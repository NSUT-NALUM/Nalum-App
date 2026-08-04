/**
 * auth Errors
 *
 * Module-specific error types and factories.
 *
 * Responsibilities:
 * - Define typed error classes or error payloads.
 * - Centralize module-specific failure cases.
 * - Keep error messages consistent.
 *
 * Do NOT:
 * - Throw errors from unrelated layers here.
 * - Mix business logic into error definitions.
 * - Duplicate generic errors that belong in shared packages.
 */

import AppError from "../../errors/app.error";
import BadRequestError from "../../errors/bad-request.error";
import ConflictError from "../../errors/conflict.error";
import ForbiddenError from "../../errors/forbidden.error";
import UnauthorizedError from "../../errors/unauthorized.error";

export class EmailAlreadyExistsError extends ConflictError {
	constructor() {
		super("Email is already registered", "AUTH_EMAIL_ALREADY_EXISTS");
		this.name = "EmailAlreadyExistsError";
	}
}

export class InvalidCredentialsError extends UnauthorizedError {
	constructor() {
		super("Invalid email or password", "AUTH_INVALID_CREDENTIALS");
		this.name = "InvalidCredentialsError";
	}
}

export class GoogleAccountNotRegisteredError extends UnauthorizedError {
	constructor() {
		super(
			"No account exists for this Google email. Choose a role on sign-up first.",
			"AUTH_GOOGLE_SIGNUP_REQUIRED",
		);
		this.name = "GoogleAccountNotRegisteredError";
	}
}

export class MissingRefreshTokenError extends UnauthorizedError {
	constructor() {
		super("Refresh token is required", "AUTH_REFRESH_TOKEN_REQUIRED");
		this.name = "MissingRefreshTokenError";
	}
}

export class InvalidRefreshTokenError extends UnauthorizedError {
	constructor() {
		super("Refresh token is invalid or expired", "AUTH_REFRESH_TOKEN_INVALID");
		this.name = "InvalidRefreshTokenError";
	}
}

export class InvalidEmailError extends BadRequestError {
	constructor() {
		super("Email is invalid", "AUTH_INVALID_EMAIL");
		this.name = "InvalidEmailError";
	}
}

export class EmailAlreadyVerifiedError extends ConflictError {
	constructor() {
		super("Email is already verified", "AUTH_EMAIL_ALREADY_VERIFIED");
		this.name = "EmailAlreadyVerifiedError";
	}
}

export class InvalidEmailOtpError extends BadRequestError {
	constructor() {
		super("OTP is invalid or expired", "AUTH_EMAIL_OTP_INVALID");
		this.name = "InvalidEmailOtpError";
	}
}

export class EmailOtpRateLimitedError extends AppError {
	constructor(retryAfterSeconds: number) {
		super(false, {
			code: "AUTH_EMAIL_OTP_RATE_LIMITED",
			message: "Please wait before requesting another verification code",
			statusCode: 429,
			details: { retryAfterSeconds },
		});
		this.name = "EmailOtpRateLimitedError";
	}
}

export class UserBannedError extends ForbiddenError {
	constructor(ban: { reason: string; expiresAt: Date | null }) {
		super("Your account is banned from the platform", "USER_BANNED", {
			reason: ban.reason,
			expiresAt: ban.expiresAt,
			permanent: ban.expiresAt === null,
		});
		this.name = "UserBannedError";
	}
}
