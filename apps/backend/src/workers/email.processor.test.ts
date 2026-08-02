import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emailProcessor, mailSender } from "./email.processor";

const { findUserByEmail } = vi.hoisted(() => ({
	findUserByEmail: vi.fn(),
}));

vi.mock("@nalum/database/client", () => ({
	createPrismaClient: () => ({
		user: { findUnique: findUserByEmail },
		alumniVerificationEvent: { update: vi.fn() },
	}),
}));

describe("emailProcessor", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		findUserByEmail.mockResolvedValue({ emailVerified: false });
	});

	it("renders the OTP template and calls the SMTP sender with the expected message", async () => {
		const sendMailSpy = vi
			.spyOn(mailSender, "sendMail")
			.mockResolvedValue(undefined);

		const mockJob = {
			name: "email-verification-otp",
			data: {
				to: "recipient@nsut.ac.in",
				firstName: "Bob",
				otp: "987654",
			},
		} as unknown as Job;

		await emailProcessor(mockJob);

		expect(sendMailSpy).toHaveBeenCalledOnce();
		expect(sendMailSpy).toHaveBeenCalledWith({
			to: "recipient@nsut.ac.in",
			subject: "Verify your Nalum email",
			text: expect.stringContaining("Bob"),
			html: expect.stringContaining("987654"),
		});

		expect(sendMailSpy.mock.calls[0]?.[0]?.text).toContain("987654");
		expect(sendMailSpy.mock.calls[0]?.[0]?.html).toContain("Bob");
	});

	it("discards a queued OTP after OAuth verifies the email", async () => {
		findUserByEmail.mockResolvedValue({ emailVerified: true });
		const sendMailSpy = vi
			.spyOn(mailSender, "sendMail")
			.mockResolvedValue(undefined);

		await emailProcessor({
			name: "email-verification-otp",
			data: {
				to: "recipient@nsut.ac.in",
				firstName: "Bob",
				otp: "987654",
			},
		} as unknown as Job);

		expect(sendMailSpy).not.toHaveBeenCalled();
	});

	it("throws an error for unsupported template names", async () => {
		const mockJob = {
			name: "unknown-template",
			data: {
				to: "recipient@nsut.ac.in",
				firstName: "Bob",
				otp: "987654",
			},
		} as unknown as Job;

		await expect(emailProcessor(mockJob)).rejects.toThrow(
			"Unsupported email template: unknown-template",
		);
	});
});
