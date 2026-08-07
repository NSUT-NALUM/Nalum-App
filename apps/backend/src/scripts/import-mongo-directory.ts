import { readFile } from "node:fs/promises";
import path from "node:path";
import { createPrismaClient } from "@nalum/database/client";
import { v5 as uuidv5 } from "uuid";
import { z } from "zod/v4";
import type {
	Branch,
	Campus,
	Prisma,
	UserRole,
} from "../database/prisma/generated/client";

const USER_NAMESPACE = "a22886ca-9de0-57a6-9c47-63ac8d9bbd47";
const expectedSummary = {
	users: 819,
	profiles: 638,
	socialMedia: 249,
	experiences: 45,
	nullLastNames: 86,
	verifiedAlumni: 235,
	pendingAlumni: 198,
} as const;

const branchByLegacyLabel = {
	Biotechnology: "BIOTECHNOLOGY",
	"COE (Computer Engineering)": "COE_COMPUTER_ENGINEERING",
	"Civil Engineering": "CIVIL_ENGINEERING",
	"Computer Science Engineering": "COMPUTER_SCIENCE_ENGINEERING",
	"Computer Science Engineering (Artificial Intelligence)":
		"COMPUTER_SCIENCE_ENGINEERING_ARTIFICIAL_INTELLIGENCE",
	"Computer Science Engineering (Big Data Analytics)":
		"COMPUTER_SCIENCE_ENGINEERING_BIG_DATA_ANALYTICS",
	"Computer Science Engineering (Data Science)":
		"COMPUTER_SCIENCE_ENGINEERING_DATA_SCIENCE",
	"Computer Science Engineering (IoT)": "COMPUTER_SCIENCE_ENGINEERING_IOT",
	"Electrical Engineering": "ELECTRICAL_ENGINEERING",
	"Electronics Engineering (VLSI Desgin)":
		"ELECTRONICS_ENGINEERING_VLSI_DESGIN",
	"Electronics and Communication Engineering":
		"ELECTRONICS_AND_COMMUNICATION_ENGINEERING",
	"Electronics and Communication Engineering (ECAM)":
		"ELECTRONICS_AND_COMMUNICATION_ENGINEERING_ECAM",
	"Geoinformatics (GI)": "GEOINFORMATICS_GI",
	"Information Technology": "INFORMATION_TECHNOLOGY",
	"Information Technology (Network Secuirty)":
		"INFORMATION_TECHNOLOGY_NETWORK_SECUIRTY",
	"Instrumentation and Control Engineering":
		"INSTRUMENTATION_AND_CONTROL_ENGINEERING",
	"MPAE (Manufacturing Processes and Automation Engineering)":
		"MPAE_MANUFACTURING_PROCESSES_AND_AUTOMATION_ENGINEERING",
	"Mathematics and Computing (MAC)": "MATHEMATICS_AND_COMPUTING_MAC",
	"Mechanical Engineering": "MECHANICAL_ENGINEERING",
	"Mechanical Engineering (MEEV)": "MECHANICAL_ENGINEERING_MEEV",
} as const satisfies Record<string, Branch>;

const campusByLegacyLabel = {
	"Main Campus": "MAIN",
	"East Campus": "EAST",
	"West Campus": "WEST",
} as const satisfies Record<string, Campus>;

const roleByLegacyValue = {
	student: "STUDENT",
	alumni: "ALUMNI",
	admin: "ADMIN",
} as const satisfies Record<string, UserRole>;

const legacyUserSchema = z.object({
	_id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid Mongo user id"),
	name: z.string().trim().min(1),
	email: z.email(),
	password: z.string().regex(/^\$2[aby]\$/i, "Expected a bcrypt password hash"),
	email_verified: z.boolean(),
	email_verified_at: z.string().datetime().nullable(),
	profileCompleted: z.boolean(),
	role: z.enum(["student", "alumni", "admin"]),
	verified_alumni: z.boolean(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

const legacyProfileSchema = z.object({
	_id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid Mongo profile id"),
	user: z.string().regex(/^[a-f\d]{24}$/i, "Invalid Mongo user reference"),
	batch: z.string(),
	branch: z.string(),
	campus: z.string(),
	social_media: z
		.object({
			linkedin: z.string().optional(),
			github: z.string().optional(),
			twitter: z.string().optional(),
			personal_website: z.string().optional(),
		})
		.optional(),
	experience: z
		.array(
			z.object({
				company: z.string(),
				role: z.string(),
				duration: z.string().optional(),
			}),
		)
		.optional(),
	current_company: z.string().nullable().optional(),
	current_role: z.string().nullable().optional(),
	location: z
		.object({
			city: z.string().nullable().optional(),
			country: z.string().nullable().optional(),
		})
		.nullable()
		.optional(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

type LegacyUser = z.infer<typeof legacyUserSchema>;
type LegacyProfile = z.infer<typeof legacyProfileSchema>;

export type DirectoryImport = {
	users: Prisma.UserCreateManyInput[];
	profiles: Prisma.ProfileCreateManyInput[];
	socialMedia: Prisma.SocialMediaCreateManyInput[];
	experiences: Prisma.ExperienceCreateManyInput[];
	summary: {
		users: number;
		profiles: number;
		socialMedia: number;
		experiences: number;
		nullLastNames: number;
		verifiedAlumni: number;
		pendingAlumni: number;
	};
};

const trimToNull = (value: string | null | undefined) => {
	const trimmed = value?.trim();
	return trimmed || null;
};

const toDate = (value: string, field: string) => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) throw new Error(`Invalid date in ${field}`);
	return date;
};

const userId = (legacyId: string) =>
	uuidv5(`mongo-user:${legacyId}`, USER_NAMESPACE);

const splitName = (name: string) => {
	const [firstName, ...lastName] = name.trim().split(/\s+/);
	if (!firstName) throw new Error("User name is empty");
	return { firstName, lastName: lastName.join(" ") || null };
};

const parseBatch = (value: string) => {
	const batch = Number(value);
	if (!Number.isInteger(batch) || batch < 1900 || batch > 2100) {
		throw new Error(`Invalid profile batch: ${value}`);
	}
	return batch;
};

const parseBranch = (value: string): Branch => {
	const branch = branchByLegacyLabel[value as keyof typeof branchByLegacyLabel];
	if (!branch) throw new Error(`Unsupported legacy branch: ${value}`);
	return branch;
};

const parseCampus = (value: string): Campus => {
	const campus = campusByLegacyLabel[value as keyof typeof campusByLegacyLabel];
	if (!campus) throw new Error(`Unsupported legacy campus: ${value}`);
	return campus;
};

const parseRole = (value: LegacyUser["role"]): UserRole =>
	roleByLegacyValue[value];

const prepareProfiles = (
	profiles: LegacyProfile[],
	knownUserIds: Set<string>,
) => {
	const profileUserIds = new Set<string>();
	const profileRows: Prisma.ProfileCreateManyInput[] = [];
	const socialRows: Prisma.SocialMediaCreateManyInput[] = [];
	const experienceRows: Prisma.ExperienceCreateManyInput[] = [];

	for (const profile of profiles) {
		if (!knownUserIds.has(profile.user)) {
			throw new Error(`Profile ${profile._id} references a missing user`);
		}
		if (profileUserIds.has(profile.user)) {
			throw new Error(`User ${profile.user} has more than one profile`);
		}
		profileUserIds.add(profile.user);

		const id = userId(profile.user);
		profileRows.push({
			userId: id,
			batch: parseBatch(profile.batch),
			branch: parseBranch(profile.branch),
			campus: parseCampus(profile.campus),
			city: trimToNull(profile.location?.city),
			country: trimToNull(profile.location?.country),
			currentCompany: trimToNull(profile.current_company),
			currentRole: trimToNull(profile.current_role),
			profilePicture: null,
			createdAt: toDate(profile.createdAt, `profile ${profile._id}.createdAt`),
			updatedAt: toDate(profile.updatedAt, `profile ${profile._id}.updatedAt`),
		});

		const socialMedia = profile.social_media;
		if (socialMedia) {
			const linkedin = trimToNull(socialMedia.linkedin);
			const github = trimToNull(socialMedia.github);
			const twitter = trimToNull(socialMedia.twitter);
			const website = trimToNull(socialMedia.personal_website);
			if (linkedin || github || twitter || website) {
				socialRows.push({ userId: id, linkedin, github, twitter, website });
			}
		}

		for (const experience of profile.experience ?? []) {
			const company = trimToNull(experience.company);
			const role = trimToNull(experience.role);
			if (!company || !role) continue;
			experienceRows.push({
				id: uuidv5(
					`mongo-profile:${profile._id}:experience:${experienceRows.length}`,
					USER_NAMESPACE,
				),
				userId: id,
				company,
				role,
				startDate: null,
				endDate: null,
				isCurrent: /\bpresent\s*$/i.test(experience.duration ?? ""),
				createdAt: toDate(
					profile.createdAt,
					`profile ${profile._id}.createdAt`,
				),
			});
		}
	}

	return { profileRows, socialRows, experienceRows };
};

export const prepareDirectoryImport = (
	legacyUsers: unknown,
	legacyProfiles: unknown,
): DirectoryImport => {
	const users = z.array(legacyUserSchema).parse(legacyUsers);
	const profiles = z.array(legacyProfileSchema).parse(legacyProfiles);
	const seenEmails = new Set<string>();
	const seenUserIds = new Set<string>();
	const userRows: Prisma.UserCreateManyInput[] = [];
	let nullLastNames = 0;
	let verifiedAlumni = 0;
	let pendingAlumni = 0;

	for (const user of users) {
		const email = user.email.trim().toLowerCase();
		if (seenEmails.has(email))
			throw new Error(`Duplicate user email: ${email}`);
		if (seenUserIds.has(user._id))
			throw new Error(`Duplicate Mongo user id: ${user._id}`);
		seenEmails.add(email);
		seenUserIds.add(user._id);

		const name = splitName(user.name);
		if (name.lastName === null) nullLastNames += 1;
		const role = parseRole(user.role);
		const createdAt = toDate(user.createdAt, `user ${user._id}.createdAt`);
		const isAlumni = role === "ALUMNI";
		const verificationStatus = isAlumni
			? user.verified_alumni
				? "VERIFIED"
				: "PENDING"
			: null;
		if (verificationStatus === "VERIFIED") verifiedAlumni += 1;
		if (verificationStatus === "PENDING") pendingAlumni += 1;

		userRows.push({
			id: userId(user._id),
			...name,
			email,
			passwordHash: user.password,
			role,
			emailVerified: user.email_verified,
			emailVerifiedAt: user.email_verified_at
				? toDate(user.email_verified_at, `user ${user._id}.email_verified_at`)
				: null,
			verificationStatus,
			verificationSubmittedAt: isAlumni ? createdAt : null,
			profileCompleted: user.profileCompleted,
			createdAt,
			updatedAt: toDate(user.updatedAt, `user ${user._id}.updatedAt`),
		});
	}

	const { profileRows, socialRows, experienceRows } = prepareProfiles(
		profiles,
		seenUserIds,
	);

	return {
		users: userRows,
		profiles: profileRows,
		socialMedia: socialRows,
		experiences: experienceRows,
		summary: {
			users: userRows.length,
			profiles: profileRows.length,
			socialMedia: socialRows.length,
			experiences: experienceRows.length,
			nullLastNames,
			verifiedAlumni,
			pendingAlumni,
		},
	};
};

const readCollection = async (source: string, name: string): Promise<unknown> =>
	JSON.parse(
		await readFile(path.join(source, "collections", `${name}.json`), "utf8"),
	);

export const loadDirectoryImport = async (source: string) => {
	const data = prepareDirectoryImport(
		await readCollection(source, "users"),
		await readCollection(source, "profiles"),
	);
	if (
		Object.entries(expectedSummary).some(
			([key, value]) =>
				data.summary[key as keyof typeof expectedSummary] !== value,
		)
	) {
		throw new Error(
			"Legacy export does not match the expected directory snapshot",
		);
	}
	return data;
};

const printSummary = (summary: DirectoryImport["summary"]) => {
	process.stdout.write(`${JSON.stringify(summary)}\n`);
};

const verifyEmptyTarget = async (
	prisma: ReturnType<typeof createPrismaClient>,
) => {
	const userCount = await prisma.user.count();
	if (userCount > 0) {
		throw new Error(`Target database is not empty (${userCount} users found)`);
	}
};

const applyDirectoryImport = async (
	prisma: ReturnType<typeof createPrismaClient>,
	data: DirectoryImport,
) => {
	await prisma.$transaction(async (tx) => {
		await tx.user.createMany({ data: data.users });
		await tx.profile.createMany({ data: data.profiles });
		if (data.socialMedia.length > 0) {
			await tx.socialMedia.createMany({ data: data.socialMedia });
		}
		if (data.experiences.length > 0) {
			await tx.experience.createMany({ data: data.experiences });
		}
		const [users, profiles, socialMedia, experiences] = await Promise.all([
			tx.user.count(),
			tx.profile.count(),
			tx.socialMedia.count(),
			tx.experience.count(),
		]);
		if (
			users !== data.summary.users ||
			profiles !== data.summary.profiles ||
			socialMedia !== data.summary.socialMedia ||
			experiences !== data.summary.experiences
		) {
			throw new Error("Imported row counts do not match the validated source");
		}
	});
};

const sourceArgument = () => {
	const sourceIndex = process.argv.indexOf("--source");
	return sourceIndex === -1 ? undefined : process.argv[sourceIndex + 1];
};

const main = async () => {
	const source = sourceArgument();
	const mode = process.argv.includes("--apply")
		? "apply"
		: process.argv.includes("--check")
			? "check"
			: null;
	if (!source || !mode) {
		throw new Error(
			"Usage: bun src/scripts/import-mongo-directory.ts --source <export-dir> --check|--apply",
		);
	}
	const data = await loadDirectoryImport(source);
	printSummary(data.summary);
	if (mode === "check") return;

	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error("DATABASE_URL is required");
	const prisma = createPrismaClient(databaseUrl);
	try {
		await verifyEmptyTarget(prisma);
		await applyDirectoryImport(prisma, data);
		process.stdout.write("Directory import completed.\n");
	} finally {
		await prisma.$disconnect();
	}
};

if (import.meta.main) {
	void main().catch((error: unknown) => {
		process.stderr.write(
			`${error instanceof Error ? error.message : "Import failed"}\n`,
		);
		process.exitCode = 1;
	});
}
