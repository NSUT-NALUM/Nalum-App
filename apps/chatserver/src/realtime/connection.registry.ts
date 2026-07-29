type SocketConnection = {
	readyState: number;
	send(message: string): void;
	close?(code?: number, reason?: string): void;
};

export class ConnectionRegistry {
	private readonly connectionsByUserId = new Map<
		string,
		Set<SocketConnection>
	>();

	add(userId: string, socket: SocketConnection) {
		const connections = this.connectionsByUserId.get(userId) ?? new Set();
		connections.add(socket);
		this.connectionsByUserId.set(userId, connections);
	}

	remove(userId: string, socket: SocketConnection) {
		const connections = this.connectionsByUserId.get(userId);
		if (!connections) return;
		connections.delete(socket);
		if (connections.size === 0) this.connectionsByUserId.delete(userId);
	}

	deliver(userId: string, message: unknown) {
		const serializedMessage = JSON.stringify(message);
		for (const socket of this.connectionsByUserId.get(userId) ?? []) {
			if (socket.readyState === 1) socket.send(serializedMessage);
		}
	}

	disconnect(userId: string, code = 4003, reason = "Platform access revoked") {
		for (const socket of this.connectionsByUserId.get(userId) ?? []) {
			socket.close?.(code, reason);
		}
		this.connectionsByUserId.delete(userId);
	}
}
