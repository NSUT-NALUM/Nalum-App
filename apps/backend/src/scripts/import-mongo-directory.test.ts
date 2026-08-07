import { describe, expect, it } from "vitest";
import { prepareDirectoryImport } from "./import-mongo-directory";

const users = [
	{
		_id: "694e89842dd401c1a9b701ae",
		name: "Mononym",
		email: "MONONYM@example.com",
		password: "$2b$10$LX0xXD0GyrTVi98jXSureOGJDzTcPlFMdB1IqHkeIGXEr55LIsTF.",
		email_verified: true,
		email_verified_at: "2026-08-06T18:01:27.433Z",
		profileCompleted: true,
		role: "alumni",
		verified_alumni: false,
		createdAt: "2025-12-26T13:11:32.829Z",
		updatedAt: "2026-08-06T18:01:27.434Z",
	},
];

const legacyUserId = "694e89842dd401c1a9b701ae";

const profiles = [
	{
		_id: "694f186ad81a238eedde2e9e",
		user: legacyUserId,
		batch: "2027",
		branch: "Information Technology",
		campus: "Main Campus",
		social_media: {
			linkedin: "https://linkedin.example/mononym",
			github: "",
			twitter: "",
			personal_website: "",
		},
		experience: [
			{ company: "Nalum", role: "Lead", duration: "Aug 2025 - Present" },
		],
		current_company: "Nalum",
		current_role: "Lead",
		location: { city: "Delhi", country: "India" },
		createdAt: "2025-12-26T13:11:32.829Z",
		updatedAt: "2026-08-06T18:01:27.434Z",
	},
];

describe("prepareDirectoryImport", () => {
	it("normalizes a directory record without inventing a last name", () => {
		const data = prepareDirectoryImport(users, profiles);

		expect(data.users[0]).toMatchObject({
			firstName: "Mononym",
			lastName: null,
			email: "mononym@example.com",
			verificationStatus: "PENDING",
		});
		expect(data.profiles[0]).toMatchObject({
			branch: "INFORMATION_TECHNOLOGY",
			campus: "MAIN",
			city: "Delhi",
			country: "India",
		});
		expect(data.experiences[0]).toMatchObject({ isCurrent: true });
		expect(data.summary).toMatchObject({
			users: 1,
			profiles: 1,
			socialMedia: 1,
			experiences: 1,
			nullLastNames: 1,
			pendingAlumni: 1,
		});
	});

	it("fails before writing when a legacy branch is unsupported", () => {
		expect(() =>
			prepareDirectoryImport(users, [
				{ ...profiles[0], branch: "Unknown branch" },
			]),
		).toThrow("Unsupported legacy branch");
	});
});
