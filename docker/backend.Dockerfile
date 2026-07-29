FROM oven/bun:1.3.11-slim

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/chatserver/package.json ./apps/chatserver/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/database/package.json ./packages/database/package.json

RUN --mount=type=cache,target=/root/.bun/install/cache \
	bun install --frozen-lockfile --production --filter backend --ignore-scripts \
		--network-concurrency 8

COPY apps/backend ./apps/backend
COPY packages/database ./packages/database

RUN bun apps/backend/node_modules/prisma/build/index.js generate --schema apps/backend/src/database/prisma/schema.prisma

WORKDIR /app/apps/backend

EXPOSE 5000

CMD ["bun", "src/scripts/start.ts", "--migrate=deploy"]
