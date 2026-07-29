import Redis from "ioredis";
import type { ConnectionRegistry } from "./connection.registry";

const CHANNEL = "chat:fanout";
const ACCESS_REVOCATION_CHANNEL = "nalum:access-revoked";

type FanoutEvent = {
	userId: string;
	message: unknown;
};

export class RedisFanout {
	private readonly publisher: Redis;
	private readonly subscriber: Redis;

	constructor(redisUrl: string, registry: ConnectionRegistry) {
		this.publisher = new Redis(redisUrl, { lazyConnect: true });
		this.subscriber = new Redis(redisUrl, { lazyConnect: true });
		this.subscriber.on("message", (channel, rawEvent) => {
			try {
				if (channel === ACCESS_REVOCATION_CHANNEL) {
					const event = JSON.parse(rawEvent) as { userId?: string };
					if (event.userId) registry.disconnect(event.userId);
					return;
				}
				if (channel !== CHANNEL) return;
				const event = JSON.parse(rawEvent) as FanoutEvent;
				registry.deliver(event.userId, event.message);
			} catch {
				// Invalid Redis messages are discarded; they never originate from clients.
			}
		});
	}

	async connect() {
		await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
		await this.subscriber.subscribe(CHANNEL, ACCESS_REVOCATION_CHANNEL);
	}

	publish(event: FanoutEvent) {
		return this.publisher.publish(CHANNEL, JSON.stringify(event));
	}

	async close() {
		await Promise.all([this.publisher.quit(), this.subscriber.quit()]);
	}
}
