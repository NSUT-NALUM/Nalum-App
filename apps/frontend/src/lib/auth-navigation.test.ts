/// <reference types="bun" />

import { describe, expect, it } from "bun:test";
import type { User } from "@/lib/api";
import { getAuthRoute } from "@/lib/auth-navigation";

const user: User = {
	id: "018f6b4f-4580-7000-8000-000000000001",
	firstName: "Test",
	lastName: "User",
	email: "test@example.com",
	role: "ALUMNI",
	emailVerified: true,
	verificationStatus: "VERIFIED",
	verificationSubmittedAt: "2026-07-24T12:00:00.000Z",
	latestReviewReason: null,
	activeBan: null,
	profileCompleted: true,
	profile: null,
	socialMedia: null,
	experiences: [],
};

describe("getAuthRoute", () => {
	it("routes signed-out users to sign in", () => {
		expect(getAuthRoute(null)).toBe("/sign-in");
	});

	it("routes unverified users to verification", () => {
		expect(getAuthRoute({ ...user, emailVerified: false })).toBe("/verify");
	});

	it("routes incomplete users to the required profile", () => {
		expect(getAuthRoute({ ...user, profileCompleted: false })).toBe("/profile");
	});

	it("routes completed users to the directory", () => {
		expect(getAuthRoute(user)).toBe("/directory");
	});

	it("routes pending alumni to review status", () => {
		expect(getAuthRoute({ ...user, verificationStatus: "PENDING" })).toBe(
			"/verification-pending",
		);
	});

	it("routes rejected alumni to the rejection screen", () => {
		expect(getAuthRoute({ ...user, verificationStatus: "REJECTED" })).toBe(
			"/verification-rejected",
		);
	});

	it("routes administrators to the admin portal", () => {
		expect(
			getAuthRoute({
				...user,
				role: "ADMIN",
				verificationStatus: null,
				profileCompleted: false,
			}),
		).toBe("/admin");
	});

	it("routes banned users to restriction details", () => {
		expect(
			getAuthRoute({
				...user,
				activeBan: {
					reason: "Policy violation",
					startsAt: "2026-07-25T00:00:00.000Z",
					expiresAt: null,
				},
			}),
		).toBe("/access-restricted");
	});
});
