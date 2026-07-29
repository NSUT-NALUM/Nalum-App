/**
 * Fastify error handler.
 *
 * Sends the normalized application error payload to the client.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { mapError } from "./error-mapper";

const errorHandler = (
	error: unknown,
	_request: FastifyRequest,
	reply: FastifyReply,
) => {
	const appError = mapError(error);

	// Send the shared error response shape.
	reply.status(appError.error.statusCode).send({
		success: appError.success,
		error: {
			...appError.error,
			status: appError.error.statusCode,
		},
	});
};

export default errorHandler;
