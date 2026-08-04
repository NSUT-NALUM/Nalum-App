import { createPrismaClient } from "@nalum/database/client";
import type { Job } from "bullmq";
import nodemailer from "nodemailer";
import { env } from "../config/env.config";
import type { EmailJobPayload } from "../queues/email.queue";
import {
	renderAlumniApprovedEmail,
	renderAlumniRejectedEmail,
} from "../templates/alumni-review.template";
import {
	renderContentNotificationEmail,
	renderOpportunityDecisionEmail,
} from "../templates/content-notification.template";
import { renderEventNotificationEmail } from "../templates/event-notification.template";
import { renderOtpEmail } from "../templates/otp.template";

const prisma = createPrismaClient(env.DATABASE_URL);

export class MailSender {
	private _transporter: nodemailer.Transporter | null = null;

	private get transporter() {
		if (!this._transporter) {
			this._transporter = nodemailer.createTransport({
				host: env.BREVO_SMTP_HOST,
				port: env.BREVO_SMTP_PORT,
				secure: false,
				auth: {
					user: env.BREVO_SMTP_USER,
					pass: env.BREVO_SMTP_PASS,
				},
			});
		}
		return this._transporter;
	}

	async sendMail(input: {
		to: string;
		subject: string;
		text: string;
		html: string;
	}) {
		if (env.NODE_ENV === "development") {
			console.log(
				`[DEV email]\nTo: ${input.to}\nSubject: ${input.subject}\nText: ${input.text}\nHTML: ${input.html}`,
			);
			return;
		}

		if (
			!env.BREVO_SMTP_HOST ||
			!env.BREVO_SMTP_PORT ||
			!env.BREVO_SMTP_USER ||
			!env.BREVO_SMTP_PASS
		) {
			throw new Error(
				"SMTP credentials are not configured. Set BREVO_SMTP_HOST, BREVO_SMTP_PORT, BREVO_SMTP_USER, and BREVO_SMTP_PASS.",
			);
		}

		await this.transporter.sendMail({
			from: {
				address: env.BREVO_FROM_EMAIL ?? env.BREVO_SMTP_USER,
				name: env.BREVO_FROM_NAME,
			},
			to: input.to,
			subject: input.subject,
			text: input.text,
			html: input.html,
		});
	}

	close() {
		if (this._transporter) {
			this._transporter.close();
			this._transporter = null;
		}
	}
}

export const mailSender = new MailSender();

export async function emailProcessor(
	job: Job<EmailJobPayload["payload"], void, string>,
) {
	if (job.name === "email-verification-otp") {
		const { to, firstName, otp } = job.data as Extract<
			EmailJobPayload,
			{ template: "email-verification-otp" }
		>["payload"];
		const user = await prisma.user.findUnique({
			where: { email: to },
			select: { emailVerified: true },
		});
		if (user?.emailVerified !== false) return;
		const rendered = renderOtpEmail({ firstName, otp });
		await mailSender.sendMail({
			to,
			subject: rendered.subject,
			text: rendered.text,
			html: rendered.html,
		});
		return;
	}

	if (job.name === "alumni-approved" || job.name === "alumni-rejected") {
		const payload = job.data as Extract<
			EmailJobPayload,
			{ template: "alumni-approved" | "alumni-rejected" }
		>["payload"];
		const rendered =
			job.name === "alumni-approved"
				? renderAlumniApprovedEmail(
						payload as Extract<
							EmailJobPayload,
							{ template: "alumni-approved" }
						>["payload"],
					)
				: renderAlumniRejectedEmail(
						payload as Extract<
							EmailJobPayload,
							{ template: "alumni-rejected" }
						>["payload"],
					);

		try {
			await mailSender.sendMail({
				to: payload.to,
				subject: rendered.subject,
				text: rendered.text,
				html: rendered.html,
			});
			await prisma.alumniVerificationEvent.update({
				where: { id: payload.eventId },
				data: {
					notificationState: "SENT",
					notificationSentAt: new Date(),
					notificationError: null,
				},
			});
		} catch (error) {
			await prisma.alumniVerificationEvent.update({
				where: { id: payload.eventId },
				data: {
					notificationState: "FAILED",
					notificationError:
						error instanceof Error
							? error.message.slice(0, 1000)
							: "Unknown error",
				},
			});
			throw error;
		}
		return;
	}

	if (job.name === "event-notification") {
		const payload = job.data as Extract<
			EmailJobPayload,
			{ template: "event-notification" }
		>["payload"];
		const rendered = renderEventNotificationEmail(payload);
		await mailSender.sendMail({
			to: payload.to,
			subject: rendered.subject,
			text: rendered.text,
			html: rendered.html,
		});
		return;
	}

	if (job.name === "content-notification") {
		const payload = job.data as Extract<
			EmailJobPayload,
			{ template: "content-notification" }
		>["payload"];
		const rendered = renderContentNotificationEmail(payload);
		await mailSender.sendMail({ to: payload.to, ...rendered });
		return;
	}

	if (job.name === "opportunity-decision") {
		const payload = job.data as Extract<
			EmailJobPayload,
			{ template: "opportunity-decision" }
		>["payload"];
		const rendered = renderOpportunityDecisionEmail(payload);
		await mailSender.sendMail({ to: payload.to, ...rendered });
		return;
	}

	throw new Error(`Unsupported email template: ${job.name}`);
}
