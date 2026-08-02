# Repository Guidelines

## Project Structure & Module Organization

NALUM v2 is a Bun/Turborepo TypeScript monorepo. Applications live in `apps/`: `backend` is the Fastify API, `chatserver` handles realtime chat, and `frontend` is the Expo/React Native client. Shared database access belongs in `packages/database`. Backend features are organized under `apps/backend/src/modules/<feature>` with route, controller, service, repository, schema, type, and error files kept together. Prisma migrations live in `apps/backend/prisma/migrations`; generated Prisma code under `src/database/prisma/generated` must not be edited. Static client assets are in `apps/frontend/assets`, while Docker and Nginx configuration live in `docker/` and `nginx/`. Follow the more specific `apps/frontend/AGENTS.md` when changing the frontend.

## Build, Test, and Development Commands

- `bun install` installs all workspace dependencies.
- `bun run dev` starts workspace development tasks through Turborepo.
- `bun run test` runs configured workspace tests; use `bun --filter backend test` for the Vitest backend suite.
- `bun run lint` checks the repository with Biome; `bun run format` applies formatting.
- `bun --filter frontend web` starts the Expo web client.
- `bun --filter backend typecheck` and `bun --filter chatserver typecheck` run TypeScript checks.
- `docker compose up -d` starts local PostgreSQL, Redis, MinIO, and application services.

## Coding Style & Naming Conventions

Biome is authoritative: use tabs, double quotes, recommended lint rules, and organized imports. Keep TypeScript strict and avoid `any`. Use lowercase dot-separated filenames such as `auth.service.ts`; feature folders are lowercase and singular. Variables and functions use `camelCase`, classes and types use `PascalCase`, and constants use `UPPER_SNAKE_CASE`. Preserve the backend flow: route → validation → controller → service → repository.

## Testing Guidelines

Backend tests use Vitest and are colocated as `*.test.ts`; frontend library checks follow the same suffix. Add focused tests beside changed behavior, especially for validation, authorization, and service rules. Run the narrow test first, then `bun run test` before submitting. No coverage threshold is currently enforced.

## Commit & Pull Request Guidelines

History uses short, plain-English summaries (for example, `Add MinIO service with Docker Compose and documentation`); no Conventional Commits policy is evident. Write imperative, specific subjects and keep unrelated changes separate. Pull requests should explain the change and verification performed, link relevant issues, call out migrations or configuration changes, and include screenshots for visible frontend updates. Never commit secrets; document new environment variables in the relevant README or example environment file.
