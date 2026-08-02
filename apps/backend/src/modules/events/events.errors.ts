import BadRequestError from "../../errors/bad-request.error";
import ConflictError from "../../errors/conflict.error";
import ForbiddenError from "../../errors/forbidden.error";
import NotFoundError from "../../errors/not-found.error";

export class EventNotFoundError extends NotFoundError {
	constructor() {
		super("Event not found", "EVENT_NOT_FOUND");
	}
}

export class EventForbiddenError extends ForbiddenError {
	constructor() {
		super("You do not have permission to manage this event", "EVENT_FORBIDDEN");
	}
}

export class EventScheduleError extends BadRequestError {
	constructor() {
		super("Event end time must be after its start time", "INVALID_EVENT_SCHEDULE");
	}
}

export class EventStateConflictError extends ConflictError {
	constructor(message = "Event is not in a valid state for this action") {
		super(message, "EVENT_STATE_CONFLICT");
	}
}

export class EventRegistrationConflictError extends ConflictError {
	constructor() {
		super("You have already joined this event", "EVENT_ALREADY_JOINED");
	}
}
