const nodeEnv = process.env.NODE_ENV ?? "development";

if (nodeEnv !== "development" && nodeEnv !== "production") {
	throw new Error(
		`NODE_ENV must be "development" or "production" when running infrastructure; received "${nodeEnv}".`,
	);
}

const composeArgs = process.argv.slice(2);

if (composeArgs.length === 0) {
	throw new Error(
		"Provide a Docker Compose command, for example: bun run docker:compose -- up -d",
	);
}

const compose = Bun.spawn(
	["docker", "compose", "--profile", nodeEnv, ...composeArgs],
	{
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
		env: {
			...process.env,
			NODE_ENV: nodeEnv,
		},
	},
);

process.exit(await compose.exited);
