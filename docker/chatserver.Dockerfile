FROM oven/bun:1.3.11-slim

WORKDIR /app

# Copy manifests first so dependency installation stays cached when source changes.
COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/chatserver/package.json ./apps/chatserver/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/database/package.json ./packages/database/package.json

RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --production --filter chatserver --ignore-scripts \
		--network-concurrency 8

COPY apps/chatserver ./apps/chatserver
COPY packages/database ./packages/database
COPY apps/backend/src/database/prisma/generated ./apps/backend/src/database/prisma/generated

WORKDIR /app/apps/chatserver

EXPOSE 3001

CMD ["bun", "src/server.ts"]
