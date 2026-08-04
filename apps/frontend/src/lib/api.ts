import { Platform } from "react-native";

export type Role = "STUDENT" | "ALUMNI" | "ADMIN" | "PROFESSOR" | "VISITOR";
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
export type EventStatus = "PENDING" | "PUBLISHED" | "REJECTED" | "CANCELLED";
export type PostStatus = "PENDING" | "PUBLISHED" | "REJECTED" | "REMOVED";
export type VoteDirection = "UP" | "DOWN";
export type PostAuthor = { id: string; firstName: string; lastName: string };
export type Post = {
	id: string;
	title: string;
	body: string;
	images: string[];
	status: PostStatus;
	authorId: string;
	reviewerId: string | null;
	moderationNote: string | null;
	rejectionReason: string | null;
	removedAt: string | null;
	createdAt: string;
	updatedAt: string;
	author: PostAuthor;
	reviewer: PostAuthor | null;
	commentCount: number;
	upvotes: number;
	downvotes: number;
	score: number;
	myVote: VoteDirection | null;
};
export type PostComment = {
	id: string;
	postId: string;
	parentId: string | null;
	authorId: string;
	body: string | null;
	editedAt: string | null;
	createdAt: string;
	updatedAt: string;
	author: PostAuthor;
	isRemoved: boolean;
	upvotes: number;
	downvotes: number;
	score: number;
	myVote: VoteDirection | null;
	replies: PostComment[];
};
export type PostPage = {
	posts: Post[];
	total: number;
	limit: number;
	offset: number;
};
export type PostCommentPage = {
	comments: PostComment[];
	total: number;
	limit: number;
	offset: number;
};
export type ContentReportStatus = "PENDING" | "DISMISSED" | "RESOLVED";
export type ContentReport = {
	id: string;
	reason: string;
	status: ContentReportStatus;
	createdAt: string;
	reviewedAt: string | null;
	reporter: PostAuthor;
	reviewer: PostAuthor | null;
	post: {
		id: string;
		title: string;
		status: PostStatus;
		author: PostAuthor;
	} | null;
	comment: {
		id: string;
		body: string;
		removedAt: string | null;
		author: PostAuthor;
		post: { id: string; title: string; status: PostStatus };
	} | null;
};
export type Event = {
	id: string;
	title: string;
	description: string;
	startsAt: string;
	endsAt: string;
	venue: string;
	meetUrl: string | null;
	images: string[];
	status: EventStatus;
	authorId: string;
	reviewerId: string | null;
	moderationNote: string | null;
	rejectionReason: string | null;
	createdAt: string;
	updatedAt: string;
	author: { id: string; firstName: string; lastName: string };
	reviewer: { id: string; firstName: string; lastName: string } | null;
	attendeeCount: number;
	isJoined: boolean;
};
export type EventPage = {
	events: Event[];
	total: number;
	limit: number;
	offset: number;
};
export type OpportunityStatus =
	| "PENDING"
	| "PUBLISHED"
	| "REJECTED"
	| "REMOVED";
export type OpportunityType = "INTERNSHIP" | "JOB";
export type OpportunityWorkMode = "REMOTE" | "HYBRID" | "ONSITE";
export type Opportunity = {
	id: string;
	roleTitle: string;
	organization: string;
	description: string;
	type: OpportunityType;
	workMode: OpportunityWorkMode;
	location: string;
	deadline: string;
	applicationUrl: string;
	status: OpportunityStatus;
	createdAt: string;
	updatedAt: string;
	moderationNote: string | null;
	rejectionReason: string | null;
	author?: PostAuthor;
	reviewer?: PostAuthor | null;
};
export type OpportunityPage = {
	opportunities: Opportunity[];
	total: number;
	limit: number;
	offset: number;
};
export type EventAttendee = {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	joinedAt: string;
	profile: Pick<Profile, "batch" | "branch" | "campus"> | null;
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
const localChatApiUrl = Platform.select({
	web: "http://localhost:3001/api",
	default: "http://10.0.2.2:3001/api",
});
const chatBaseUrl =
	process.env.EXPO_PUBLIC_CHAT_API_URL ??
	(__DEV__ ? localChatApiUrl : "/chat-api");
let accessToken: string | null = null;
let refreshing: Promise<string | null> | null = null;
export const getToken = () => accessToken;
export const clearToken = () => {
	accessToken = null;
};

export const apiImageSource = (uri: string) => ({
	uri:
		uri.startsWith("http://") ||
		uri.startsWith("https://") ||
		!baseUrl.startsWith("http")
			? uri
			: new URL(uri, baseUrl).toString(),
	headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
});
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

export const getChatToken = async (forceRefresh = false) =>
	forceRefresh ? refresh() : (accessToken ?? refresh());
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

async function chatRequest<T>(
	path: string,
	init: RequestInit = {},
	retry = true,
): Promise<T> {
	const token = await getChatToken();
	const headers = new Headers(init.headers);
	if (token) headers.set("Authorization", `Bearer ${token}`);
	const response = await fetch(`${chatBaseUrl}${path}`, { ...init, headers });
	if (response.status === 401 && retry && (await refresh()))
		return chatRequest<T>(path, init, false);
	const payload = (await response.json().catch(() => null)) as
		| T
		| { code?: string; message?: string }
		| null;
	if (!response.ok)
		throw new ApiError(
			response.status,
			payload && typeof payload === "object" && "code" in payload
				? (payload.code ?? "REQUEST_FAILED")
				: "REQUEST_FAILED",
			payload && typeof payload === "object" && "message" in payload
				? (payload.message ?? "Request failed")
				: "Request failed",
		);
	return payload as T;
}

export type ChatPerson = { id: string; firstName: string; lastName: string };
export type ChatAttachment = {
	id: string;
	key: string;
	contentType: string;
	url: string;
};
export type ChatReaction = {
	emoji: string;
	count: number;
	reactedByMe: boolean;
};
export type ChatReadReceipt = {
	userId: string;
	lastReadMessageId: string | null;
	lastReadAt: string | null;
};
export type ChatMessage = {
	id: string;
	conversationId: string;
	senderId: string;
	clientMessageId: string;
	type: "USER" | "SYSTEM";
	text: string;
	createdAt: string;
	editedAt: string | null;
	deletedAt: string | null;
	replyTo: {
		messageId: string;
		text: string | null;
		senderId: string | null;
	} | null;
	attachments: ChatAttachment[];
	mentionUserIds: string[];
	mentionsEveryone: boolean;
	reactions: ChatReaction[];
};
export type Conversation = {
	id: string;
	type: "DIRECT" | "GROUP";
	name: string | null;
	lastMessageAt: string;
	unreadCount: number;
	unreadMentionCount: number;
	participants: Array<{
		userId: string;
		role: "OWNER" | "ADMIN" | "MEMBER";
		joinedAt: string;
		lastReadMessageId: string | null;
		lastReadAt: string | null;
		user: Omit<ChatPerson, "id">;
	}>;
	messages: ChatMessage[];
};
export type ChatMessagePage = {
	messages: ChatMessage[];
	readReceipt: ChatReadReceipt;
	readReceipts: ChatReadReceipt[];
	nextCursor: string | null;
};
export type GroupInvitation = {
	id: string;
	conversationId: string;
	inviterId: string;
	inviteeId: string;
	status: "PENDING" | "ACCEPTED" | "DECLINED";
	createdAt: string;
	updatedAt: string;
	conversation: Pick<Conversation, "id" | "name" | "type">;
	inviter: ChatPerson;
};
export type ConnectionRequest = {
	id: string;
	requesterId: string;
	recipientId: string;
	text: string;
	status: "PENDING" | "ACCEPTED" | "DECLINED";
	createdAt: string;
	updatedAt: string;
	requester: ChatPerson;
	recipient: ChatPerson;
};

export const chatApi = {
	conversations: () =>
		chatRequest<{ conversations: Conversation[] }>("/conversations"),
	messages: (conversationId: string, cursor?: string) =>
		chatRequest<ChatMessagePage>(
			`/conversations/${conversationId}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
		),
	uploadImage: (conversationId: string, form: FormData) =>
		api<ChatAttachment>(
			`/chat/attachments?conversationId=${encodeURIComponent(conversationId)}`,
			{ method: "POST", body: form },
		),
	requests: (direction: "incoming" | "outgoing") =>
		chatRequest<ConnectionRequest[]>(`/connection-requests/${direction}`),
	createRequest: (recipientUserId: string, text: string) =>
		chatRequest<ConnectionRequest>("/connection-requests", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ recipientUserId, text }),
		}),
	acceptRequest: (requestId: string) =>
		chatRequest<{ conversation: Conversation }>(
			`/connection-requests/${requestId}/accept`,
			{ method: "POST" },
		),
	declineRequest: (requestId: string) =>
		chatRequest(`/connection-requests/${requestId}/decline`, {
			method: "POST",
		}),
	createGroup: (name: string, inviteeIds: string[]) =>
		chatRequest<{ id: string }>("/conversations/groups", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, inviteeIds }),
		}),
	groupInvitations: () =>
		chatRequest<GroupInvitation[]>("/group-invitations/incoming"),
	acceptGroupInvitation: (invitationId: string) =>
		chatRequest(`/group-invitations/${invitationId}/accept`, {
			method: "POST",
		}),
	declineGroupInvitation: (invitationId: string) =>
		chatRequest(`/group-invitations/${invitationId}/decline`, {
			method: "POST",
		}),
	inviteMember: (conversationId: string, userId: string) =>
		chatRequest(`/conversations/${conversationId}/invitations`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userId }),
		}),
	removeMember: (conversationId: string, userId: string) =>
		chatRequest(`/conversations/${conversationId}/members/${userId}`, {
			method: "DELETE",
		}),
	leaveGroup: (conversationId: string) =>
		chatRequest(`/conversations/${conversationId}/leave`, { method: "POST" }),
	updateMemberRole: (
		conversationId: string,
		userId: string,
		role: "ADMIN" | "MEMBER",
	) =>
		chatRequest(`/conversations/${conversationId}/members/${userId}/role`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ role }),
		}),
	transferOwnership: (conversationId: string, userId: string) =>
		chatRequest(
			`/conversations/${conversationId}/members/${userId}/ownership`,
			{ method: "POST" },
		),
};

export const getChatWebSocketUrl = () => {
	if (process.env.EXPO_PUBLIC_CHAT_WS_URL)
		return process.env.EXPO_PUBLIC_CHAT_WS_URL;
	if (__DEV__)
		return (
			Platform.select({
				web: "ws://localhost:3001/ws",
				default: "ws://10.0.2.2:3001/ws",
			}) ?? null
		);
	if (Platform.OS === "web" && typeof window !== "undefined") {
		return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
	}
	return null;
};
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
	googleUrl: `${baseUrl}/auth/google/signin`,
	googleSignupUrl: (role: Exclude<Role, "ADMIN">) =>
		`${baseUrl}/auth/google/signup?role=${encodeURIComponent(role)}`,
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

export type EventListParams = {
	when?: "upcoming" | "past";
	startsFrom?: string;
	startsTo?: string;
	limit?: number;
	offset?: number;
};

export type AdminEventListParams = EventListParams & {
	status?: EventStatus;
	authorId?: string;
	q?: string;
};

export type PostListParams = { limit?: number; offset?: number };
export type AdminPostListParams = PostListParams & {
	status?: PostStatus;
	q?: string;
};
export type AdminOpportunityListParams = PostListParams & {
	status?: OpportunityStatus;
	q?: string;
};
export type ReportListParams = PostListParams & {
	status?: ContentReportStatus;
	target?: "post" | "comment";
};

export const eventsApi = {
	list: (params: EventListParams = {}) =>
		api<EventPage>(`/events?${queryString(params)}`),
	mine: (params: EventListParams = {}) =>
		api<EventPage>(`/events/mine?${queryString(params)}`),
	get: (eventId: string) => api<Event>(`/events/${eventId}`),
	create: (form: FormData) =>
		api<Event>("/events", { method: "POST", body: form }),
	update: (eventId: string, form: FormData) =>
		api<Event>(`/events/${eventId}`, { method: "PATCH", body: form }),
	remove: (eventId: string) =>
		api<{ eventId: string }>(`/events/${eventId}`, { method: "DELETE" }),
	cancel: (eventId: string) =>
		api<{ eventId: string; status: "CANCELLED" }>(`/events/${eventId}/cancel`, {
			method: "POST",
		}),
	join: (eventId: string) =>
		api<{ eventId: string; isJoined: true }>(`/events/${eventId}/join`, {
			method: "POST",
		}),
	leave: (eventId: string) =>
		api<{ eventId: string; isJoined: false }>(`/events/${eventId}/join`, {
			method: "DELETE",
		}),
	attendees: (
		eventId: string,
		params: Pick<EventListParams, "limit" | "offset"> = {},
	) =>
		api<{
			attendees: EventAttendee[];
			total: number;
			limit: number;
			offset: number;
		}>(`/events/${eventId}/attendees?${queryString(params)}`),
	adminList: (params: AdminEventListParams = {}) =>
		api<EventPage>(`/admin/events?${queryString(params)}`),
	approve: (eventId: string, note?: string) =>
		api<{ eventId: string; status: "PUBLISHED" }>(
			`/admin/events/${eventId}/approve`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ note: note || undefined }),
			},
		),
	reject: (eventId: string, reason: string) =>
		api<{ eventId: string; status: "REJECTED" }>(
			`/admin/events/${eventId}/reject`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason }),
			},
		),
};

export const postsApi = {
	list: (params: PostListParams = {}) =>
		api<PostPage>(`/posts?${queryString(params)}`),
	mine: (params: PostListParams = {}) =>
		api<PostPage>(`/posts/mine?${queryString(params)}`),
	get: (postId: string) => api<Post>(`/posts/${postId}`),
	create: (form: FormData) =>
		api<Post>("/posts", { method: "POST", body: form }),
	update: (postId: string, form: FormData) =>
		api<Post>(`/posts/${postId}`, { method: "PATCH", body: form }),
	comments: (postId: string, params: PostListParams = {}) =>
		api<PostCommentPage>(`/posts/${postId}/comments?${queryString(params)}`),
	createComment: (postId: string, body: string, parentId?: string) =>
		api<PostComment>(`/posts/${postId}/comments`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ body, parentId }),
		}),
	updateComment: (commentId: string, body: string) =>
		api<PostComment>(`/posts/comments/${commentId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ body }),
		}),
	setPostVote: (postId: string, direction: VoteDirection) =>
		api<{ postId: string; direction: VoteDirection }>(`/posts/${postId}/vote`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ direction }),
		}),
	removePostVote: (postId: string) =>
		api<{ postId: string; direction: null }>(`/posts/${postId}/vote`, {
			method: "DELETE",
		}),
	setCommentVote: (commentId: string, direction: VoteDirection) =>
		api<{ commentId: string; direction: VoteDirection }>(
			`/posts/comments/${commentId}/vote`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ direction }),
			},
		),
	removeCommentVote: (commentId: string) =>
		api<{ commentId: string; direction: null }>(
			`/posts/comments/${commentId}/vote`,
			{ method: "DELETE" },
		),
	reportPost: (postId: string, reason: string) =>
		api<{ reportId: string; status: ContentReportStatus }>(
			`/posts/${postId}/reports`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason }),
			},
		),
	reportComment: (commentId: string, reason: string) =>
		api<{ reportId: string; status: ContentReportStatus }>(
			`/posts/comments/${commentId}/reports`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason }),
			},
		),
	adminList: (params: AdminPostListParams = {}) =>
		api<PostPage>(`/admin/posts?${queryString(params)}`),
	approve: (postId: string, note?: string) =>
		api<{ postId: string; status: "PUBLISHED" }>(
			`/admin/posts/${postId}/approve`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ note: note || undefined }),
			},
		),
	reject: (postId: string, reason: string) =>
		api<{ postId: string; status: "REJECTED" }>(
			`/admin/posts/${postId}/reject`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason }),
			},
		),
	reports: (params: ReportListParams = {}) =>
		api<{
			reports: ContentReport[];
			total: number;
			limit: number;
			offset: number;
		}>(`/admin/posts/reports?${queryString(params)}`),
	dismissReport: (reportId: string) =>
		api<{ reportId: string; status: "DISMISSED" }>(
			`/admin/posts/reports/${reportId}/dismiss`,
			{ method: "POST" },
		),
	removeReportedContent: (reportId: string) =>
		api<{ outcome: "POST_REMOVED" | "COMMENT_REMOVED" }>(
			`/admin/posts/reports/${reportId}/remove-content`,
			{ method: "POST" },
		),
};
export const opportunitiesApi = {
	list: (params: PostListParams = {}) =>
		api<OpportunityPage>(`/opportunities?${queryString(params)}`),
	mine: (params: PostListParams = {}) =>
		api<OpportunityPage>(`/opportunities/mine?${queryString(params)}`),
	get: (opportunityId: string) =>
		api<Opportunity>(`/opportunities/${opportunityId}`),
	create: (
		input: Omit<
			Opportunity,
			| "id"
			| "status"
			| "createdAt"
			| "updatedAt"
			| "moderationNote"
			| "rejectionReason"
			| "author"
			| "reviewer"
		>,
	) =>
		api<Opportunity>("/opportunities", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		}),
	update: (
		opportunityId: string,
		input: Partial<
			Pick<
				Opportunity,
				| "roleTitle"
				| "organization"
				| "description"
				| "type"
				| "workMode"
				| "location"
				| "deadline"
				| "applicationUrl"
			>
		>,
	) =>
		api<Opportunity>(`/opportunities/${opportunityId}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		}),
	adminList: (params: AdminOpportunityListParams = {}) =>
		api<OpportunityPage>(`/admin/opportunities?${queryString(params)}`),
	approve: (opportunityId: string, note?: string) =>
		api<{ opportunityId: string; status: "PUBLISHED" }>(
			`/admin/opportunities/${opportunityId}/approve`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ note: note || undefined }),
			},
		),
	reject: (opportunityId: string, reason: string) =>
		api<{ opportunityId: string; status: "REJECTED" }>(
			`/admin/opportunities/${opportunityId}/reject`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ reason }),
			},
		),
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
