import IORedis from "ioredis";

export const ACCESS_REVOCATION_CHANNEL = "nalum:access-revoked";

export interface AccessRevocationPublisher {
	publish(userId: string): Promise<void>;
}

export class RedisAccessRevocationPublisher
	implements AccessRevocationPublisher
{
	private readonly redis: IORedis;

	constructor(redisUrl: string) {
		this.redis = new IORedis(redisUrl, {
			maxRetriesPerRequest: 1,
			lazyConnect: true,
		});
	}

	async publish(userId: string) {
		if (this.redis.status === "wait") await this.redis.connect();
		await this.redis.publish(
			ACCESS_REVOCATION_CHANNEL,
			JSON.stringify({ userId, revokedAt: new Date().toISOString() }),
		);
	}

	async close() {
		if (this.redis.status !== "wait" && this.redis.status !== "end") {
			await this.redis.quit();
		}
	}
}
