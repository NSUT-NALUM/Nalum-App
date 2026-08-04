import type { RenderedEmail } from "./otp.template";

const escapeHtml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");

export function renderContentNotificationEmail(input: {
	contentType: "Post" | "Event" | "Opportunity";
	title: string;
	authorName: string;
	authorEmail: string;
	status: "PENDING" | "PUBLISHED";
}): RenderedEmail {
	const review =
		input.status === "PENDING"
			? "It needs moderation."
			: "It was published immediately.";
	return {
		subject: `New Nalum ${input.contentType.toLowerCase()}: ${input.title}`,
		text: `${input.authorName} (${input.authorEmail}) submitted ${input.contentType.toLowerCase()} “${input.title}”. ${review}`,
		html: `<h2>New Nalum ${escapeHtml(input.contentType)}</h2><p><strong>${escapeHtml(input.title)}</strong></p><p>Submitted by ${escapeHtml(input.authorName)} (${escapeHtml(input.authorEmail)}).</p><p>${review}</p>`,
	};
}

export function renderOpportunityDecisionEmail(input: {
	firstName: string;
	title: string;
	status: "PUBLISHED" | "REJECTED";
	reason: string | null;
}): RenderedEmail {
	const approved = input.status === "PUBLISHED";
	return {
		subject: `Your Nalum opportunity was ${approved ? "approved" : "not approved"}`,
		text: `Hi ${input.firstName}, “${input.title}” was ${approved ? "approved and published" : "not approved"}.${input.reason ? ` Note: ${input.reason}` : ""}`,
		html: `<p>Hi ${escapeHtml(input.firstName)},</p><p><strong>${escapeHtml(input.title)}</strong> was ${approved ? "approved and published" : "not approved"}.</p>${input.reason ? `<p>Note: ${escapeHtml(input.reason)}</p>` : ""}`,
	};
}
