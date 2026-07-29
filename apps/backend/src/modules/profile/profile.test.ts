import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
	Branch,
	Campus,
	Profile,
} from "../../database/prisma/generated/client";
import {
	ProfileAlreadyExistsError,
	ProfileNotFoundError,
	ProfileRollNumberRequiredError,
} from "./profile.errors";
import type { ProfileRepository } from "./profile.repository";
import { ProfileService } from "./profile.service";

const now = new Date();

const sampleProfile: Profile = {
	userId: "018f6b4f-4580-7000-8000-000000000001",
	rollNumber: null,
	batch: 2026,
	branch: "CSE" as Branch,
	campus: "MAIN" as Campus,
	phoneNumber: null,
	alternateEmail: null,
	city: "New Delhi",
	country: "India",
	latitude: null,
	longitude: null,
	currentCompany: null,
	currentRole: null,
	profilePicture: null,
	createdAt: now,
	updatedAt: now,
};

type MockProfileRepository = {
	[Key in keyof ProfileRepository]: ReturnType<typeof vi.fn>;
};

const createRepository = (): MockProfileRepository =>
	({
		findProfileByUserId: vi.fn(),
		createProfile: vi.fn(),
		updateProfile: vi.fn(),
	}) as unknown as MockProfileRepository;

describe("ProfileService", () => {
	let repository: MockProfileRepository;
	let service: ProfileService;

	beforeEach(() => {
		repository = createRepository();
		service = new ProfileService(repository as unknown as ProfileRepository);
	});

	describe("getProfile", () => {
		it("returns profile when it exists", async () => {
			repository.findProfileByUserId.mockResolvedValue(sampleProfile);

			const result = await service.getProfile(sampleProfile.userId);

			expect(repository.findProfileByUserId).toHaveBeenCalledWith(
				sampleProfile.userId,
			);
			expect(result).toEqual(sampleProfile);
		});

		it("throws ProfileNotFoundError when profile does not exist", async () => {
			repository.findProfileByUserId.mockResolvedValue(null);

			await expect(
				service.getProfile(sampleProfile.userId),
			).rejects.toBeInstanceOf(ProfileNotFoundError);
		});
	});

	describe("createProfile", () => {
		it("creates a new profile when one does not exist", async () => {
			repository.findProfileByUserId.mockResolvedValue(null);
			repository.createProfile.mockResolvedValue(sampleProfile);

			const createData = {
				batch: 2026,
				branch: "CSE" as Branch,
				campus: "MAIN" as Campus,
			};

			const result = await service.createProfile(
				sampleProfile.userId,
				createData,
			);

			expect(repository.findProfileByUserId).toHaveBeenCalledWith(
				sampleProfile.userId,
			);
			expect(repository.createProfile).toHaveBeenCalledWith(
				sampleProfile.userId,
				{ ...createData, rollNumber: null },
				"STUDENT",
			);
			expect(result).toEqual(sampleProfile);
		});

		it("throws ProfileAlreadyExistsError when profile already exists", async () => {
			repository.findProfileByUserId.mockResolvedValue(sampleProfile);

			const createData = {
				batch: 2026,
				branch: "CSE" as Branch,
				campus: "MAIN" as Campus,
			};

			await expect(
				service.createProfile(sampleProfile.userId, createData),
			).rejects.toBeInstanceOf(ProfileAlreadyExistsError);
		});

		it("requires and normalizes an alumni roll number", async () => {
			repository.findProfileByUserId.mockResolvedValue(null);
			await expect(
				service.createProfile(
					sampleProfile.userId,
					{ batch: 2026, branch: "CSE", campus: "MAIN" },
					"ALUMNI",
				),
			).rejects.toBeInstanceOf(ProfileRollNumberRequiredError);

			repository.createProfile.mockResolvedValue({
				...sampleProfile,
				rollNumber: "2022UCS001",
			});
			await service.createProfile(
				sampleProfile.userId,
				{
					batch: 2026,
					branch: "CSE",
					campus: "MAIN",
					rollNumber: " 2022 ucs 001 ",
				},
				"ALUMNI",
			);
			expect(repository.createProfile).toHaveBeenLastCalledWith(
				sampleProfile.userId,
				expect.objectContaining({ rollNumber: "2022UCS001" }),
				"ALUMNI",
			);
		});
	});

	describe("editProfile", () => {
		it("updates existing profile successfully", async () => {
			repository.findProfileByUserId.mockResolvedValue(sampleProfile);
			const updatedProfile = { ...sampleProfile, city: "Bengaluru" };
			repository.updateProfile.mockResolvedValue(updatedProfile);

			const result = await service.editProfile(sampleProfile.userId, {
				city: "Bengaluru",
			});

			expect(repository.findProfileByUserId).toHaveBeenCalledWith(
				sampleProfile.userId,
			);
			expect(repository.updateProfile).toHaveBeenCalledWith(
				sampleProfile.userId,
				{
					city: "Bengaluru",
				},
				undefined,
				false,
			);
			expect(result.city).toBe("Bengaluru");
		});

		it("throws ProfileNotFoundError when profile to update does not exist", async () => {
			repository.findProfileByUserId.mockResolvedValue(null);

			await expect(
				service.editProfile(sampleProfile.userId, { city: "Bengaluru" }),
			).rejects.toBeInstanceOf(ProfileNotFoundError);
		});

		it("resubmits a verified alumnus after a sensitive edit", async () => {
			repository.findProfileByUserId.mockResolvedValue(sampleProfile);
			repository.updateProfile.mockResolvedValue({
				...sampleProfile,
				batch: 2027,
			});
			const publish = vi.fn();
			const verificationService = new ProfileService(
				repository as unknown as ProfileRepository,
				{ publish },
			);

			await verificationService.editProfile(
				sampleProfile.userId,
				{ batch: 2027 },
				undefined,
				{ role: "ALUMNI", verificationStatus: "VERIFIED" },
			);

			expect(repository.updateProfile).toHaveBeenCalledWith(
				sampleProfile.userId,
				{ batch: 2027 },
				undefined,
				true,
			);
			expect(publish).toHaveBeenCalledWith(sampleProfile.userId);
		});
	});
});
