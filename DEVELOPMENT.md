# Development commands

Run the full local stack with hot reload:

```sh
bun run dev:stack
```

Press `Ctrl-C` to stop the local backend, chatserver, and email worker. The
dependency containers stay running.

```sh
# Stop containers but keep them for later reuse.
bun run docker:compose -- stop

# Stop and remove containers; named volumes are preserved.
bun run docker:compose -- down
```

Backend commands:

```sh
bun --filter backend dev                # Hot reload, no migration
bun --filter backend start              # Start, no migration
bun --filter backend start:db:deploy    # Apply pending migrations, then start
bun --filter backend start:db:reset     # Reset data, migrate, then start
bun --filter backend db:migrate:deploy  # Apply pending migrations only
bun --filter backend db:migrate:reset   # Reset data and migrate only
```

Start only the dependency containers:

```sh
bun run docker:compose -- up -d --wait postgres redis minio minio-console pgadmin redisinsight
```
