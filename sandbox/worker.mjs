import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_MODEL = "crest-alpha";

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function assertString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value.trim();
}

function parseJobInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Job input must be an object.");
  }

  if (input.jobType !== "subagent_smoke") {
    throw new Error("Unsupported sandbox job type.");
  }

  const mode = input.mode === "mock" ? "mock" : "live";
  const prompt = assertString(input.prompt, "prompt").slice(0, 2000);
  const expectedForbiddenEnv = Array.isArray(input.expectedForbiddenEnv)
    ? input.expectedForbiddenEnv
        .filter((key) => typeof key === "string" && key.trim())
        .map((key) => key.trim())
    : [];

  return {
    jobType: "subagent_smoke",
    mode,
    prompt,
    expectedForbiddenEnv,
  };
}

async function loadAgentsSdk() {
  return import("@openai/agents");
}

async function runMockSubAgent(prompt) {
  await loadAgentsSdk();
  return {
    mode: "mock",
    model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
    outputText: `Mock sandbox sub-agent received ${prompt.length} characters and returned from inside the container.`,
    sdkLoaded: true,
  };
}

async function runLiveSubAgent(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not available inside the sandbox.");
  }

  const { Agent, run } = await loadAgentsSdk();
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const agent = new Agent({
    name: "Studio 24 Sandbox Smoke Sub-Agent",
    model,
    instructions: [
      "You are a Studio 24 sub-agent running inside an isolated sandbox.",
      "Reply in one short sentence.",
      "Confirm that you received the task and name one concrete next step.",
      "Do not mention secrets, keys, tokens, or environment variables.",
    ].join("\n"),
  });

  const result = await run(agent, prompt, {
    maxTurns: 2,
  });

  return {
    mode: "live",
    model,
    outputText: String(result.finalOutput ?? "").trim().slice(0, 2000),
    sdkLoaded: true,
  };
}

async function runJob(job) {
  const subAgentResult =
    job.mode === "mock"
      ? await runMockSubAgent(job.prompt)
      : await runLiveSubAgent(job.prompt);

  return {
    ok: true,
    jobType: "subagent_smoke",
    subAgentResult: {
      ...subAgentResult,
      forbiddenEnvPresent: job.expectedForbiddenEnv.filter(
        (key) => Boolean(process.env[key]),
      ),
    },
    artifacts: [],
  };
}

async function writeResult(outputPath, result) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

async function main() {
  const inputPath = getArg("--input");
  const outputPath = getArg("--output");
  if (!inputPath || !outputPath) {
    throw new Error("Usage: worker.mjs --input input.json --output output.json");
  }

  try {
    const input = parseJobInput(
      JSON.parse(await readFile(inputPath, "utf8")),
    );
    await writeResult(outputPath, await runJob(input));
  } catch (error) {
    await writeResult(outputPath, {
      ok: false,
      error: "Sandbox worker failed.",
      details: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  }
}

await main();
