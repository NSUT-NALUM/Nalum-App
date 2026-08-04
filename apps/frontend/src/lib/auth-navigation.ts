import type { User } from "@/lib/api";

export type AuthRoute =
	| "/sign-in"
	| "/verify"
	| "/profile"
	| "/access-restricted"
	| "/verification-pending"
	| "/verification-rejected"
	| "/publisher"
	| "/directory"
	| "/admin";

export function getAuthRoute(user: User | null): AuthRoute {
	if (!user) return "/sign-in";
	if (!user.emailVerified) return "/verify";
	if (user.activeBan) return "/access-restricted";
	if (user.role === "VISITOR") return "/publisher";
	if (user.role === "ADMIN") return "/admin";
	if (!user.profileCompleted) return "/profile";
	if (user.role === "ALUMNI") {
		if (user.verificationStatus === "REJECTED") return "/verification-rejected";
		if (user.verificationStatus !== "VERIFIED") return "/verification-pending";
	}
	return "/directory";
}
