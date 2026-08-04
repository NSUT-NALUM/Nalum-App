import type { FastifyReply, FastifyRequest } from "fastify";
import type { User, UserBan } from "../database/prisma/generated/client";
import ForbiddenError from "../errors/forbidden.error";
import UnauthorizedError from "../errors/unauthorized.error";
import type { AccessTokenPayload } from "../modules/auth/auth.types";

declare module "@fastify/jwt" {
	interface FastifyJWT {
		payload: AccessTokenPayload;
		user: AccessTokenPayload;
	}
}

declare module "fastify" {
	interface FastifyRequest {
		currentUser?: User & { bans: UserBan[] };
	}
}

export const getCurrentUser = (request: FastifyRequest) => {
	if (!request.currentUser) {
		throw new UnauthorizedError("Authentication required", "AUTH_REQUIRED");
	}
	return request.currentUser;
};

export const authenticate = async (
	request: FastifyRequest,
	_reply: FastifyReply,
) => {
	try {
		const user = await request.jwtVerify<AccessTokenPayload>();

		if (user.tokenType !== "access") {
			throw new UnauthorizedError(
				"Invalid token type",
				"AUTH_INVALID_TOKEN_TYPE",
			);
		}
	} catch (error) {
		if (error instanceof UnauthorizedError) {
			throw error;
		}

		throw new UnauthorizedError("Authentication required", "AUTH_REQUIRED");
	}
};

export const authenticateUser = async (
	request: FastifyRequest,
	_reply: FastifyReply,
) => {
	await authenticate(request, _reply);

	const userId = request.user.sub;
	const user = await request.server.prisma.user.findUnique({
		where: { id: userId },
		include: {
			bans: {
				where: {
					revokedAt: null,
					OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
				},
			},
		},
	});

	if (!user) {
		throw new UnauthorizedError("User not found or deleted", "USER_NOT_FOUND");
	}

	request.currentUser = user;
};

export const requireApplicationAccess = async (
	request: FastifyRequest,
	reply: FastifyReply,
) => {
	await authenticateUser(request, reply);
	const user = getCurrentUser(request);
	const ban = user.bans[0];
	if (ban) {
		throw new ForbiddenError(
			"Your account is banned from the platform",
			"USER_BANNED",
			{
				reason: ban.reason,
				expiresAt: ban.expiresAt,
				permanent: ban.expiresAt === null,
			},
		);
	}
};

export const requirePlatformAccess = async (
	request: FastifyRequest,
	reply: FastifyReply,
) => {
	await requireApplicationAccess(request, reply);
	const user = getCurrentUser(request);

	if (user.role === "VISITOR") {
		throw new ForbiddenError(
			"Visitor accounts only have publisher workspace access",
			"MEMBER_ACCESS_REQUIRED",
		);
	}

	if (user.role !== "ALUMNI" || user.verificationStatus === "VERIFIED") return;

	if (user.verificationStatus === "REJECTED") {
		throw new ForbiddenError(
			"Your alumni application was rejected",
			"ALUMNI_VERIFICATION_REJECTED",
		);
	}

	throw new ForbiddenError(
		"Your alumni application is awaiting verification",
		"ALUMNI_VERIFICATION_PENDING",
	);
};

export const requirePublisherAccess = async (
	request: FastifyRequest,
	reply: FastifyReply,
) => {
	await requireApplicationAccess(request, reply);
	const user = getCurrentUser(request);
	if (user.role === "VISITOR") {
		if (user.emailVerified) return;
		throw new ForbiddenError(
			"Verify your email before publishing",
			"EMAIL_VERIFICATION_REQUIRED",
		);
	}
	if (user.role === "ALUMNI" && user.verificationStatus !== "VERIFIED") {
		throw new ForbiddenError(
			user.verificationStatus === "REJECTED"
				? "Your alumni application was rejected"
				: "Your alumni application is awaiting verification",
			user.verificationStatus === "REJECTED"
				? "ALUMNI_VERIFICATION_REJECTED"
				: "ALUMNI_VERIFICATION_PENDING",
		);
	}
};

export const requireAdmin = async (
	request: FastifyRequest,
	reply: FastifyReply,
) => {
	await requirePlatformAccess(request, reply);
	if (getCurrentUser(request).role !== "ADMIN") {
		throw new ForbiddenError(
			"Administrator access is required",
			"ADMIN_REQUIRED",
		);
	}
};

export const protect = requirePlatformAccess;
