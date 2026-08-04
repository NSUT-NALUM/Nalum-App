import ForbiddenError from "../../errors/forbidden.error";
import NotFoundError from "../../errors/not-found.error";

export class OpportunityForbiddenError extends ForbiddenError {
	constructor(
		message = "You cannot access opportunities",
		code = "OPPORTUNITY_FORBIDDEN",
	) {
		super(message, code);
		this.name = "OpportunityForbiddenError";
	}
}

export class OpportunityNotFoundError extends NotFoundError {
	constructor() {
		super("Opportunity not found", "OPPORTUNITY_NOT_FOUND");
		this.name = "OpportunityNotFoundError";
	}
}

export class OpportunityStateConflictError extends ForbiddenError {
	constructor() {
		super(
			"This opportunity can no longer be changed",
			"OPPORTUNITY_STATE_CONFLICT",
		);
		this.name = "OpportunityStateConflictError";
	}
}
