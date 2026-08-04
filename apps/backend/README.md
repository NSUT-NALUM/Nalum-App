# Nalum backend

## Alumni verification

Alumni accounts follow this access lifecycle:

`email verification → profile submission → PENDING → VERIFIED or REJECTED`

Only verified alumni have platform access. Auth routes, `GET /api/users/me`,
and the applicant's own profile routes remain available while a review is
pending or rejected. Platform guards return stable 403 codes:

- `ALUMNI_VERIFICATION_PENDING`
- `ALUMNI_VERIFICATION_REJECTED`
- `USER_BANNED` (with reason and expiry details)

Changing an alumnus's roll number, batch, branch, or campus creates a new
verification event and immediately returns the application to `PENDING`.

## Database migrations

From `apps/backend`, use `bun run db:migrate:deploy` to apply pending
migrations or `bun run db:migrate:reset` to reset the database and reapply
them. Reset deletes database data.

Use `bun run start:db:deploy` or `bun run start:db:reset` to run the selected
migration action before starting the server. `bun run start` starts the server
without running migrations.

## Administration

Admin endpoints are under `/api/admin` and require an `ADMIN` access token.
They include overview statistics, paginated alumni reviews, transactional
approve/reject/reopen decisions, user search, and temporary/permanent bans.

Create or update the first trusted administrator from an interactive SSH
terminal:

```sh
bun run admin:create
```

The command reads the password without echoing it, hashes it with Argon2id,
and verifies the administrator email. No credential is written to the
repository.

Approval and rejection emails use deterministic BullMQ job IDs. Review events
retain notification state, and the API reconciles unsent jobs at startup and
every five minutes.
