/// <reference types="bun" />

import { afterEach, describe, expect, it, mock } from "bun:test";

mock.module("react-native", () => ({
	Platform: { select: ({ web }: { web: string }) => web },
}));

const originalFetch = globalThis.fetch;
(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("events API", () => {
	it("forwards event browse filters", async () => {
		let requestedUrl = "";
		globalThis.fetch = (async (input) => {
			requestedUrl = String(input);
			return new Response(
				JSON.stringify({
					success: true,
					message: "ok",
					data: { events: [], total: 0, limit: 20, offset: 0 },
				}),
			);
		}) as typeof fetch;
		const { eventsApi } = await import("@/lib/api");

		await eventsApi.list({
			when: "past",
			startsFrom: "2026-08-01T00:00:00.000Z",
			limit: 20,
			offset: 40,
		});

		const url = new URL(requestedUrl);
		expect(url.pathname).toBe("/api/events");
		expect(Object.fromEntries(url.searchParams)).toEqual({
			when: "past",
			startsFrom: "2026-08-01T00:00:00.000Z",
			limit: "20",
			offset: "40",
		});
	});

	it("keeps event images as multipart fields", async () => {
		let body: FormData | null = null;
		let contentType = "";
		globalThis.fetch = (async (_input, init) => {
			body = init?.body as FormData;
			contentType = new Headers(init?.headers).get("Content-Type") ?? "";
			return new Response(
				JSON.stringify({
					success: true,
					message: "ok",
					data: { id: "event-id" },
				}),
			);
		}) as typeof fetch;
		const { eventsApi } = await import("@/lib/api");
		const form = new FormData();
		form.append("title", "Talk");
		form.append("images", new Blob(["first"]), "first.jpg");
		form.append("images", new Blob(["second"]), "second.jpg");

		await eventsApi.create(form);

		expect(contentType).toBe("");
		expect((body as FormData | null)?.getAll("images")).toHaveLength(2);
	});
});
