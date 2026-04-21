import { Sandbox } from "@vercel/sandbox";
import {
  getWorkerPackageJson,
  getTimeoutMs,
  getWorkerSource,
  loadEnvFile,
  WORKER_DIR,
  WORKER_PATH,
} from "./sandbox-utils.mjs";

loadEnvFile();

const timeout = Math.max(getTimeoutMs(), 600_000);
const expirationDays = Number(process.env.SANDBOX_SNAPSHOT_EXPIRATION_DAYS || "30");
const expiration =
  Number.isFinite(expirationDays) && expirationDays >= 0
    ? Math.trunc(expirationDays * 24 * 60 * 60 * 1000)
    : 30 * 24 * 60 * 60 * 1000;

const sandbox = await Sandbox.create({
  runtime: "node24",
  networkPolicy: {
    allow: ["registry.npmjs.org", "*.npmjs.org"],
  },
  resources: { vcpus: 1 },
  timeout,
});

try {
  await sandbox.mkDir(WORKER_DIR);
  await sandbox.writeFiles([
    {
      path: `${WORKER_DIR}/package.json`,
      content: getWorkerPackageJson(),
    },
    { path: WORKER_PATH, content: getWorkerSource() },
  ]);

  const install = await sandbox.runCommand({
    cmd: "npm",
    args: ["install", "--omit=dev", "--no-audit", "--no-fund"],
    cwd: WORKER_DIR,
  });

  if (install.exitCode !== 0) {
    throw new Error(await install.stderr());
  }

  const snapshot = await sandbox.snapshot({ expiration });
  console.log(`SANDBOX_SNAPSHOT_ID=${snapshot.snapshotId}`);
  console.log(`Snapshot status: ${snapshot.status}`);
} catch (error) {
  await sandbox.stop({ blocking: true }).catch(() => undefined);
  throw error;
}
