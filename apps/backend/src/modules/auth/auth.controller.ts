/**
 * auth Controller
 *
 * Responsibilities:
 * - Parse incoming requests.
 * - Delegate work to the service layer.
 * - Return HTTP responses.
 *
 * Do NOT:
 * - Contain business logic.
 * - Access the database.
 * - Perform validation.
 */
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../config/env.config";
import { getCurrentUser } from "../../middlewares/auth.middleware";
import {
	ACCESS_TOKEN_EXPIRY,
	DEVICE_ID_COOKIE_NAME,
	DEVICE_ID_COOKIE_PATH,
	REFRESH_TOKEN_COOKIE_NAME,
	REFRESH_TOKEN_COOKIE_PATH,
} from "./auth.constants";
import type {
	LoginBody,
	RegisterBody,
	SessionParams,
	VerifyEmailOtpBody,
} from "./auth.schema";
import type { AuthService } from "./auth.service";
import type {
	AccessTokenPayload,
	AuthSession,
	GoogleUserInfo,
} from "./auth.types";

export class AuthController {
	constructor(private readonly authService: AuthService) {}

	register = async (
		request: FastifyRequest<{ Body: RegisterBody }>,
		reply: FastifyReply,
	) => {
		const session = await this.authService.register(
			request.body,
			this.getDevice(request),
		);
		return this.sendAuthSession(
			request,
			reply,
			session,
			"Registered successfully",
			201,
		);
	};

	login = async (
		request: FastifyRequest<{ Body: LoginBody }>,
		reply: FastifyReply,
	) => {
		const session = await this.authService.login(
			request.body,
			this.getDevice(request),
		);
		return this.sendAuthSession(
			request,
			reply,
			session,
			"Logged in successfully",
		);
	};

	refresh = async (request: FastifyRequest, reply: FastifyReply) => {
		const session = await this.authService.refresh(
			request.cookies[REFRESH_TOKEN_COOKIE_NAME],
			this.getDevice(request),
		);
		return this.sendAuthSession(request, reply, session, "Token refreshed");
	};

	logout = async (request: FastifyRequest, reply: FastifyReply) => {
		await this.authService.logout(request.cookies[REFRESH_TOKEN_COOKIE_NAME]);

		this.clearRefreshCookie(reply);
		return reply.success(null, "Logged out successfully");
	};

	listSessions = async (request: FastifyRequest, reply: FastifyReply) =>
		reply.success(
			await this.authService.listSessions(getCurrentUser(request).id),
		);

	revokeSession = async (request: FastifyRequest, reply: FastifyReply) => {
		const { sessionId } = request.params as SessionParams;
		await this.authService.revokeSession(getCurrentUser(request).id, sessionId);
		return reply.success(null, "Session revoked");
	};

	sendEmailVerificationOtp = async (
		request: FastifyRequest,
		reply: FastifyReply,
	) => {
		await this.authService.sendEmailVerificationOtp(getCurrentUser(request));
		return reply.success(null, "Email verification OTP sent");
	};

	verifyEmailOtp = async (request: FastifyRequest, reply: FastifyReply) => {
		const body = request.body as VerifyEmailOtpBody;
		await this.authService.verifyEmailOtp(getCurrentUser(request), body.otp);
		return reply.success(null, "Email verified successfully");
	};

	googleCallback = async (request: FastifyRequest, reply: FastifyReply) => {
		const { token } =
			await request.server.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(
				request,
				reply,
			);

		const response = await fetch(
			"https://openidconnect.googleapis.com/v1/userinfo",
			{
				headers: {
					Authorization: `Bearer ${token.access_token}`,
				},
			},
		);

		if (!response.ok) {
			throw new Error("Failed to fetch Google profile");
		}

		const profile = (await response.json()) as GoogleUserInfo;
		const device = this.getDevice(request);
		const session = await this.authService.loginWithGoogle(profile, device);
		this.setDeviceCookie(reply, device.id);
		this.setRefreshCookie(
			reply,
			session.refreshToken,
			session.refreshTokenExpiresAt,
		);
		return reply.redirect(
			new URL("/auth/callback", env.WEB_APP_URL).toString(),
			302,
		);
	};

	private async sendAuthSession(
		request: FastifyRequest,
		reply: FastifyReply,
		session: AuthSession,
		message: string,
		statusCode = 200,
	) {
		this.setDeviceCookie(reply, this.getDevice(request).id);
		this.setRefreshCookie(
			reply,
			session.refreshToken,
			session.refreshTokenExpiresAt,
		);

		const accessToken = await reply.jwtSign(
			session.accessTokenPayload satisfies AccessTokenPayload,
			{
				sign: {
					expiresIn: ACCESS_TOKEN_EXPIRY,
				},
			},
		);

		return reply.success(
			{
				accessToken,
				user: session.user,
			},
			message,
			statusCode,
		);
	}

	private getDevice(request: FastifyRequest) {
		return {
			id: request.cookies[DEVICE_ID_COOKIE_NAME] ?? crypto.randomUUID(),
			name: request.headers["user-agent"]?.slice(0, 200) ?? null,
		};
	}

	private setDeviceCookie(reply: FastifyReply, deviceId: string) {
		reply.setCookie(DEVICE_ID_COOKIE_NAME, deviceId, {
			httpOnly: true,
			path: DEVICE_ID_COOKIE_PATH,
			sameSite: "lax",
			secure: env.NODE_ENV === "production",
			signed: false,
			maxAge: 60 * 60 * 24 * 365,
		});
	}

	private setRefreshCookie(
		reply: FastifyReply,
		refreshToken: string,
		expiresAt: Date,
	) {
		reply.setCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
			expires: expiresAt,
			httpOnly: true,
			path: REFRESH_TOKEN_COOKIE_PATH,
			sameSite: "lax",
			secure: env.NODE_ENV === "production",
			signed: false,
		});
	}

	private clearRefreshCookie(reply: FastifyReply) {
		reply.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
			httpOnly: true,
			path: REFRESH_TOKEN_COOKIE_PATH,
			sameSite: "lax",
			secure: env.NODE_ENV === "production",
			signed: false,
		});
	}
}
