import { Platform } from "react-native";

export type Role = "STUDENT" | "ALUMNI" | "ADMIN" | "PROFESSOR";
export type Branch =
	| "CSE"
	| "ECE"
	| "MECH"
	| "CIVIL"
	| "CHEMICAL"
	| "BIOTECH"
	| "ELECTRICAL"
	| "INSTRUMENTATION"
	| "AEROSPACE"
	| "MATERIALS"
	| "INDUSTRIAL"
	| "PRODUCTION";
export type Campus = "MAIN" | "EAST" | "WEST";
export type AlumniVerificationStatus = "PENDING" | "VERIFIED" | "REJECTED";
export type Profile = {
	userId: string;
	rollNumber: string | null;
	batch: number;
	branch: Branch;
	campus: Campus;
	phoneNumber: string | null;
	alternateEmail: string | null;
	city: string | null;
	country: string | null;
	currentCompany: string | null;
	currentRole: string | null;
	profilePicture: string | null;
};
export type Experience = {
	id?: string;
	company: string;
	role: string;
	startDate: string | null;
	endDate: string | null;
	isCurrent: boolean;
};
export type User = {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	role: Role;
	emailVerified: boolean;
	verificationStatus: AlumniVerificationStatus | null;
	verificationSubmittedAt: string | null;
	latestReviewReason: string | null;
	activeBan: {
		reason: string;
		expiresAt: string | null;
		startsAt: string;
	} | null;
	profileCompleted: boolean;
	profile: Profile | null;
	socialMedia: Record<string, string | null> | null;
	experiences: Experience[];
};
type Envelope<T> = { success: true; message: string; data: T };
type ErrorEnvelope = {
	success: false;
	error: {
		statusCode: number;
		code: string;
		message: string;
		details?: unknown;
	};
};

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly details?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}
}
/**
 * Production is served behind Nginx, where the API is available at the same
 * origin under `/api`. Expo's development server does not proxy that path, so
 * browser development must use the backend's explicit local origin instead.
 */
const localApiUrl = Platform.select({
	web: "http://localhost:5000/api",
	default: "http://10.0.2.2:5000/api",
});

const baseUrl =
	process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? localApiUrl : "/api");
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
export const getToken = () => accessToken;
export const clearToken = () => {
	accessToken = null;
};
async function refresh() {
	if (!refreshing)
		refreshing = fetch(`${baseUrl}/auth/refresh`, {
			method: "POST",
			credentials: "include",
		})
			.then(async (r) =>
				r.ok
					? ((await r.json()) as Envelope<{ accessToken: string }>).data
							.accessToken
					: null,
			)
			.catch(() => null)
			.finally(() => {
				refreshing = null;
			});
	accessToken = await refreshing;
	return accessToken;
}
export async function api<T>(
	path: string,
	init: RequestInit = {},
	retry = true,
): Promise<T> {
	const headers = new Headers(init.headers);
	if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
	const response = await fetch(`${baseUrl}${path}`, {
		...init,
		headers,
		credentials: "include",
	});
	if (response.status === 401 && retry && (await refresh()))
		return api<T>(path, init, false);
	const payload = (await response.json().catch(() => null)) as
		| Envelope<T>
		| ErrorEnvelope
		| { code?: string; message?: string }
		| null;
	if (!response.ok) {
		if (payload && "error" in payload) {
			throw new ApiError(
				response.status,
				payload.error.code,
				payload.error.message,
				payload.error.details,
			);
		}
		throw new ApiError(
			response.status,
			payload && "code" in payload
				? (payload.code ?? "REQUEST_FAILED")
				: "REQUEST_FAILED",
			payload && "message" in payload
				? (payload.message ?? "Request failed")
				: "Request failed",
		);
	}
	return (payload as Envelope<T>).data;
}
export const authApi = {
	restore: async () => {
		await refresh();
		return api<User>("/users/me");
	},
	refreshUser: () => api<User>("/users/me"),
	login: (email: string, password: string) =>
		api<{ accessToken: string }>("/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email, password }),
		}).then(async (x) => {
			accessToken = x.accessToken;
			return api<User>("/users/me");
		}),
	register: (input: {
		firstName: string;
		lastName: string;
		email: string;
		password: string;
		role: Role;
	}) =>
		api<{ accessToken: string; user: User }>("/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		}).then((x) => {
			accessToken = x.accessToken;
			return {
				...x.user,
				latestReviewReason: null,
				activeBan: null,
				profile: null,
				socialMedia: null,
				experiences: [],
			};
		}),
	logout: async () => {
		await api("/auth/logout", { method: "POST" });
		clearToken();
	},
	sendOtp: () => api("/auth/email-verification/send", { method: "POST" }),
	verifyOtp: (otp: string) =>
		api("/auth/email-verification/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ otp }),
		}),
	googleUrl: `${baseUrl}/auth/login/google`,
};
export const profileApi = {
	create: (
		input: Pick<Profile, "batch" | "branch" | "campus"> & {
			rollNumber?: string;
		},
	) =>
		api<Profile>("/profile/", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		}),
	update: (form: FormData) =>
		api<Profile>("/profile/", { method: "PUT", body: form }),
};

export type AdminOverview = {
	totalUsers: number;
	roleCounts: Record<string, number>;
	alumniStatusCounts: Record<string, number>;
	pendingReviews: number;
	activeBans: number;
	recentRegistrations: number;
};

export type AdminUser = User & {
	createdAt: string;
	updatedAt: string;
	verificationEvents?: Array<{
		id: string;
		type: string;
		reason: string | null;
		previousStatus: AlumniVerificationStatus | null;
		newStatus: AlumniVerificationStatus;
		notificationState: string;
		createdAt: string;
		actor?: {
			firstName: string;
			lastName: string;
			email: string;
		} | null;
	}>;
	bans?: Array<{
		id: string;
		reason: string;
		startsAt: string;
		expiresAt: string | null;
		revokedAt: string | null;
	}>;
};

const queryString = (
	params: Record<string, string | number | boolean | undefined>,
) =>
	new URLSearchParams(
		Object.entries(params)
			.filter(([, value]) => value !== undefined && value !== "")
			.map(([key, value]) => [key, String(value)]),
	).toString();

export const adminApi = {
	overview: () => api<AdminOverview>("/admin/overview"),
	alumni: (params: Record<string, string | number | undefined>) =>
		api<{ users: AdminUser[]; total: number; limit: number; offset: number }>(
			`/admin/alumni?${queryString(params)}`,
		),
	application: (userId: string) => api<AdminUser>(`/admin/alumni/${userId}`),
	approve: (userId: string, note?: string) =>
		api(`/admin/alumni/${userId}/approve`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ note: note || undefined }),
		}),
	reject: (userId: string, reason: string) =>
		api(`/admin/alumni/${userId}/reject`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reason }),
		}),
	reopen: (userId: string, reason: string) =>
		api(`/admin/alumni/${userId}/reopen`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reason }),
		}),
	users: (params: Record<string, string | number | undefined>) =>
		api<{ users: AdminUser[]; total: number; limit: number; offset: number }>(
			`/admin/users?${queryString(params)}`,
		),
	user: (userId: string) => api<AdminUser>(`/admin/users/${userId}`),
	ban: (userId: string, reason: string, expiresAt?: string | null) =>
		api(`/admin/users/${userId}/ban`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ reason, expiresAt }),
		}),
	unban: (userId: string) =>
		api(`/admin/users/${userId}/unban`, { method: "POST" }),
};
export const usersApi = (
	params: Record<string, string | number | boolean | undefined>,
) => {
	const query = new URLSearchParams(
		Object.entries(params)
			.filter(([, v]) => v !== undefined && v !== "")
			.map(([k, v]) => [k, String(v)]),
	).toString();
	return api<{ users: User[]; total: number; limit: number; offset: number }>(
		`/users/search${query ? `?${query}` : ""}`,
	);
};
