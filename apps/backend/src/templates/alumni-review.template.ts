import type { RenderedEmail } from "./otp.template";

const escapeHtml = (value: string) =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");

export function renderAlumniApprovedEmail(input: {
	firstName: string;
	note: string | null;
	signInUrl: string;
}): RenderedEmail {
	const note = input.note ? ` Reviewer note: ${input.note}` : "";
	return {
		subject: "Your Nalum alumni profile is approved",
		text: `Hi ${input.firstName}, your alumni profile has been approved.${note} Sign in: ${input.signInUrl}`,
		html: `<h2>Welcome to Nalum</h2><p>Hi ${escapeHtml(input.firstName)},</p><p>Your alumni profile has been approved. You can now use the directory, storage, and chat.</p>${input.note ? `<p><strong>Reviewer note:</strong> ${escapeHtml(input.note)}</p>` : ""}<p><a href="${escapeHtml(input.signInUrl)}">Sign in to Nalum</a></p>`,
	};
}

export function renderAlumniRejectedEmail(input: {
	firstName: string;
	reason: string;
	signInUrl: string;
}): RenderedEmail {
	return {
		subject: "Update needed for your Nalum alumni profile",
		text: `Hi ${input.firstName}, your alumni profile could not be approved. Reason: ${input.reason} Sign in to correct and resubmit your verification details. If you need help, contact the Nalum support team. ${input.signInUrl}`,
		html: `<h2>Your alumni profile needs an update</h2><p>Hi ${escapeHtml(input.firstName)},</p><p>We could not approve your alumni profile.</p><p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p><p>Sign in to correct your verification details and resubmit. If you believe this is a mistake, contact the Nalum support team.</p><p><a href="${escapeHtml(input.signInUrl)}">Review your application</a></p>`,
	};
}
