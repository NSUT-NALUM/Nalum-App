import NotFoundError from "../../errors/not-found.error";
import { toStorageObjectUrl } from "../storage/storage.keys";
import type { UserRepository } from "./user.repository";
import type {
	PublicUserDetails,
	SearchUsersFilters,
	UserDetailsRecord,
} from "./user.types";

export class UserService {
	constructor(private readonly userRepository: UserRepository) {}

	async getUserDetails(userId: string): Promise<PublicUserDetails> {
		const user = await this.userRepository.findUserDetailsById(userId);

		if (!user) {
			throw new NotFoundError("User not found", "USER_NOT_FOUND");
		}

		return this.toPublicUserDetails(user);
	}

	async searchUsers(filters: SearchUsersFilters) {
		const { users, total } = await this.userRepository.searchUsers(filters);

		return {
			users: users.map((user) => this.toPublicUserDetails(user)),
			total,
			limit: filters.limit,
			offset: filters.offset,
		};
	}

	private toPublicUserDetails(user: UserDetailsRecord): PublicUserDetails {
		const {
			passwordHash: _passwordHash,
			googleId: _googleId,
			verificationEvents,
			bans,
			...publicUser
		} = user;
		return {
			...publicUser,
			latestReviewReason: verificationEvents[0]?.reason ?? null,
			activeBan: bans[0]
				? {
						reason: bans[0].reason,
						expiresAt: bans[0].expiresAt,
						startsAt: bans[0].startsAt,
					}
				: null,
			profile: publicUser.profile
				? {
						...publicUser.profile,
						profilePicture: toStorageObjectUrl(
							publicUser.profile.profilePicture,
						),
					}
				: null,
		};
	}
}
