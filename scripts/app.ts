const localDatabaseUrl = (await Bun.file("apps/backend/.env").text())
	.match(/^DATABASE_URL=(.+)$/m)?.[1]
	?.trim();

if (!localDatabaseUrl) {
	throw new Error("apps/backend/.env must define DATABASE_URL");
}

const localEnv = { ...process.env, DATABASE_URL: localDatabaseUrl };

const dockerApps = Bun.spawn(
	["docker", "compose", "stop", "backend", "chatserver", "email-worker"],
	{ stdin: "inherit", stdout: "inherit", stderr: "inherit" },
);

const dockerAppsExitCode = await dockerApps.exited;
if (dockerAppsExitCode !== 0) process.exit(dockerAppsExitCode);

const infra = Bun.spawn(
	[
		"docker",
		"compose",
		"--profile",
		"development",
		"up",
		"-d",
		"--wait",
		"postgres",
		"redis",
		"minio",
		"minio-console",
		"pgadmin",
		"redisinsight",
	],
	{ stdin: "inherit", stdout: "inherit", stderr: "inherit" },
);

const infraExitCode = await infra.exited;
if (infraExitCode !== 0) process.exit(infraExitCode);

const bun = ["bun", "--no-env-file", "--env-file=.env"];
const migrate = Bun.spawn([...bun, "run", "db:migrate:deploy"], {
	cwd: "apps/backend",
	env: localEnv,
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
});
const migrateExitCode = await migrate.exited;
if (migrateExitCode !== 0) process.exit(migrateExitCode);

const processes = [
	Bun.spawn([...bun, "--hot", "src/server.ts"], {
		cwd: "apps/backend",
		env: localEnv,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	}),
	Bun.spawn([...bun, "--hot", "src/workers/email.worker.ts"], {
		cwd: "apps/backend",
		env: localEnv,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	}),
	Bun.spawn([...bun, "--hot", "src/server.ts"], {
		cwd: "apps/chatserver",
		env: localEnv,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	}),
];

let stopping = false;
const stop = () => {
	if (stopping) return;
	stopping = true;
	for (const child of processes) child.kill();
};

process.once("SIGINT", stop);
process.once("SIGTERM", stop);

const exitCode = await Promise.race(processes.map((child) => child.exited));
stop();
process.exit(exitCode);
