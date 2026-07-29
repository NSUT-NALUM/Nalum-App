import { env } from "../../config/env.config";
import { enqueueEmail } from "../../queues/email.queue";

export interface IEmailService {
	sendEmailVerificationOtp(input: {
		to: string;
		firstName: string;
		otp: string;
	}): Promise<void>;
	sendAlumniDecision(input: {
		eventId: string;
		to: string;
		firstName: string;
		status: "VERIFIED" | "REJECTED";
		reason: string | null;
	}): Promise<void>;
}

export class EmailService implements IEmailService {
	async sendEmailVerificationOtp(input: {
		to: string;
		firstName: string;
		otp: string;
	}) {
		await enqueueEmail("email-verification-otp", input);
	}

	async sendAlumniDecision(input: {
		eventId: string;
		to: string;
		firstName: string;
		status: "VERIFIED" | "REJECTED";
		reason: string | null;
	}) {
		const common = {
			eventId: input.eventId,
			to: input.to,
			firstName: input.firstName,
			signInUrl: new URL("/sign-in", env.WEB_APP_URL).toString(),
		};
		if (input.status === "VERIFIED") {
			await enqueueEmail(
				"alumni-approved",
				{ ...common, note: input.reason },
				`alumni-decision-${input.eventId}`,
			);
			return;
		}
		await enqueueEmail(
			"alumni-rejected",
			{
				...common,
				reason: input.reason ?? "Your application could not be verified.",
			},
			`alumni-decision-${input.eventId}`,
		);
	}
}
