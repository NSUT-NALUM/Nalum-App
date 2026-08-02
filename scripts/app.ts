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
const migrate = Bun.spawn([...bun, "run", "db:migrate"], {
	cwd: "apps/backend",
	stdin: "inherit",
	stdout: "inherit",
	stderr: "inherit",
});
const migrateExitCode = await migrate.exited;
if (migrateExitCode !== 0) process.exit(migrateExitCode);

const processes = [
	Bun.spawn([...bun, "--hot", "src/server.ts"], {
		cwd: "apps/backend",
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	}),
	Bun.spawn([...bun, "--hot", "src/workers/email.worker.ts"], {
		cwd: "apps/backend",
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	}),
	Bun.spawn([...bun, "--hot", "src/server.ts"], {
		cwd: "apps/chatserver",
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
