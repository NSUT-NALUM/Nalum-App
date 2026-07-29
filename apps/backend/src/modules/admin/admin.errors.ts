import BadRequestError from "../../errors/bad-request.error";
import ConflictError from "../../errors/conflict.error";
import ForbiddenError from "../../errors/forbidden.error";
import NotFoundError from "../../errors/not-found.error";

export class AdminUserNotFoundError extends NotFoundError {
	constructor() {
		super("User not found", "ADMIN_USER_NOT_FOUND");
	}
}

export class ReviewDecisionConflictError extends ConflictError {
	constructor() {
		super(
			"The application is no longer pending",
			"ADMIN_REVIEW_DECISION_CONFLICT",
		);
	}
}

export class ReviewReopenConflictError extends ConflictError {
	constructor() {
		super(
			"Only verified or rejected applications can be reopened",
			"ADMIN_REVIEW_REOPEN_CONFLICT",
		);
	}
}

export class ProtectedAdminBanError extends ForbiddenError {
	constructor() {
		super("Administrator accounts cannot be banned", "ADMIN_BAN_PROTECTED");
	}
}

export class ActiveBanConflictError extends ConflictError {
	constructor() {
		super("User already has an active ban", "ADMIN_ACTIVE_BAN_EXISTS");
	}
}

export class InvalidBanExpiryError extends BadRequestError {
	constructor() {
		super("Ban expiry must be in the future", "ADMIN_INVALID_BAN_EXPIRY");
	}
}
