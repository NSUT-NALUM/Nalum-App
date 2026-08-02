/// <reference types="bun" />

import { afterEach, describe, expect, it, mock } from "bun:test";

mock.module("react-native", () => ({
	Platform: { select: ({ web }: { web: string }) => web },
}));

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("member search", () => {
	it("forwards every discovery filter to the existing users endpoint", async () => {
		(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;
		let requestedUrl = "";
		globalThis.fetch = (async (input) => {
			requestedUrl = String(input);
			return new Response(
				JSON.stringify({
					success: true,
					message: "ok",
					data: { users: [], total: 0, limit: 30, offset: 0 },
				}),
				{ headers: { "Content-Type": "application/json" } },
			);
		}) as typeof fetch;
		const { usersApi } = await import("@/lib/api");

		await usersApi({
			role: "ALUMNI",
			branch: "CSE",
			campus: "MAIN",
			batch: 2018,
			company: "Acme",
			city: "Delhi",
			country: "India",
			limit: 30,
			offset: 0,
		});

		const url = new URL(requestedUrl);
		expect(url.pathname).toBe("/api/users/search");
		expect(Object.fromEntries(url.searchParams)).toEqual({
			role: "ALUMNI",
			branch: "CSE",
			campus: "MAIN",
			batch: "2018",
			company: "Acme",
			city: "Delhi",
			country: "India",
			limit: "30",
			offset: "0",
		});
	});
});
