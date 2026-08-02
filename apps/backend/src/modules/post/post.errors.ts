import BadRequestError from "../../errors/bad-request.error";
import ConflictError from "../../errors/conflict.error";
import ForbiddenError from "../../errors/forbidden.error";
import NotFoundError from "../../errors/not-found.error";

export class PostNotFoundError extends NotFoundError {
	constructor() {
		super("Post not found", "POST_NOT_FOUND");
	}
}

export class CommentNotFoundError extends NotFoundError {
	constructor() {
		super("Comment not found", "COMMENT_NOT_FOUND");
	}
}

export class ContentReportNotFoundError extends NotFoundError {
	constructor() {
		super("Report not found", "CONTENT_REPORT_NOT_FOUND");
	}
}

export class PostForbiddenError extends ForbiddenError {
	constructor() {
		super(
			"You do not have permission to perform this post action",
			"POST_FORBIDDEN",
		);
	}
}

export class PostStateConflictError extends ConflictError {
	constructor(
		message = "Post content is not in a valid state for this action",
	) {
		super(message, "POST_STATE_CONFLICT");
	}
}

export class ContentReportConflictError extends ConflictError {
	constructor() {
		super(
			"You already have an open report for this content",
			"CONTENT_REPORT_EXISTS",
		);
	}
}

export class PostReplyDepthError extends BadRequestError {
	constructor() {
		super(
			"Replies can only be made to top-level comments",
			"COMMENT_REPLY_DEPTH_EXCEEDED",
		);
	}
}
