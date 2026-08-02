import type { RenderedEmail } from "./otp.template";

const escapeHtml = (value: string) =>
	value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export function renderEventNotificationEmail(input: {
	authorName: string;
	authorEmail: string;
	title: string;
	startsAt: string;
	endsAt: string;
	status: "PENDING" | "PUBLISHED";
}): RenderedEmail {
	const review = input.status === "PENDING" ? "It needs moderation." : "It was published immediately.";
	return {
		subject: `New Nalum event: ${input.title}`,
		text: `${input.authorName} (${input.authorEmail}) created “${input.title}”. ${input.startsAt} to ${input.endsAt}. ${review}`,
		html: `<h2>New Nalum event</h2><p><strong>${escapeHtml(input.title)}</strong></p><p>Created by ${escapeHtml(input.authorName)} (${escapeHtml(input.authorEmail)}).</p><p>${escapeHtml(input.startsAt)} to ${escapeHtml(input.endsAt)}.</p><p>${review}</p>`,
	};
}
