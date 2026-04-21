import path from "node:path";
import {
  getDockerImage,
  getModeFromArgs,
  getSandboxCommandEnv,
  getTimeoutMs,
  loadEnvFile,
  makeSmokeInput,
  makeTempJobDir,
  readJson,
  removeTempJobDir,
  runCommand,
  writeJson,
} from "./sandbox-utils.mjs";

loadEnvFile();

const mode = getModeFromArgs();
const input = makeSmokeInput(mode);
const jobDir = await makeTempJobDir();
const inputPath = path.join(jobDir, "input.json");
const outputPath = path.join(jobDir, "output.json");
const commandEnv = getSandboxCommandEnv();
const containerName = `studio-24-sandbox-smoke-${Date.now()}`;

await writeJson(inputPath, input);

const networkArgs = mode === "mock" ? ["--network", "none"] : [];
const envArgs = Object.keys(commandEnv).flatMap((key) => ["--env", key]);

try {
  await runCommand(
    "docker",
    [
      "run",
      "--rm",
      "--name",
      containerName,
      "--cpus",
      "1",
      "--memory",
      "768m",
      "--pids-limit",
      "128",
      ...networkArgs,
      "--volume",
      `${jobDir}:/studio-24-job`,
      "--workdir",
      "/app",
      ...envArgs,
      getDockerImage(),
      "--input",
      "/studio-24-job/input.json",
      "--output",
      "/studio-24-job/output.json",
    ],
    {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ...commandEnv,
      },
      timeout: getTimeoutMs(),
    },
  );

  console.log(JSON.stringify(await readJson(outputPath), null, 2));
} catch (error) {
  await runCommand("docker", ["rm", "-f", containerName], {
    env: { PATH: process.env.PATH },
  }).catch(() => undefined);
  throw error;
} finally {
  await removeTempJobDir(jobDir);
}
