import { Sandbox } from "@vercel/sandbox";
import {
  getModeFromArgs,
  getSandboxCommandEnv,
  getTimeoutMs,
  getWorkerPackageJson,
  getWorkerSource,
  INPUT_PATH,
  JOB_DIR,
  loadEnvFile,
  makeSmokeInput,
  OUTPUT_PATH,
  WORKER_DIR,
  WORKER_PATH,
} from "./sandbox-utils.mjs";

loadEnvFile();

const mode = getModeFromArgs();
const input = makeSmokeInput(mode);
const timeout = getTimeoutMs();
const snapshotId = process.env.SANDBOX_SNAPSHOT_ID;
const needsInstall = !snapshotId;
const networkPolicy =
  mode === "mock" && !needsInstall
    ? "deny-all"
    : {
        allow: needsInstall
          ? ["api.openai.com", "*.openai.com", "registry.npmjs.org", "*.npmjs.org"]
          : ["api.openai.com", "*.openai.com"],
      };

const sandbox = await Sandbox.create({
  ...(snapshotId
    ? { source: { type: "snapshot", snapshotId } }
    : { runtime: "node24" }),
  env: getSandboxCommandEnv(),
  networkPolicy,
  resources: { vcpus: 1 },
  timeout,
});

try {
  if (needsInstall) {
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
  }

  await sandbox.mkDir(JOB_DIR);
  await sandbox.writeFiles([{ path: INPUT_PATH, content: JSON.stringify(input) }]);

  const command = await sandbox.runCommand({
    cmd: "node",
    args: [WORKER_PATH, "--input", INPUT_PATH, "--output", OUTPUT_PATH],
    cwd: WORKER_DIR,
    env: getSandboxCommandEnv(),
  });

  const output = await sandbox.fs.readFile(OUTPUT_PATH, "utf8");
  console.log(output);

  if (command.exitCode !== 0) {
    throw new Error(await command.stderr());
  }
} finally {
  await sandbox.stop({ blocking: true }).catch(() => undefined);
}
