/**
 * Base application error type.
 *
 * Exposes the shared error payload used by the backend error classes.
 */
export interface AppErrorDetails {
	code: string;
	message: string;
	statusCode: number;
	details?: unknown;
}

/**
 * Shared error wrapper for backend failures.
 */
class AppError extends Error {
	constructor(
		public success: boolean,
		public error: AppErrorDetails,
	) {
		super(error.message);
		this.name = "AppError";
		Object.setPrototypeOf(this, new.target.prototype);
		Error.captureStackTrace?.(this, new.target);
	}
}

export default AppError;
