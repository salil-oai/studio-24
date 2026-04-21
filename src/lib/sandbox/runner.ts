import {
  assertSandboxReadyForMode,
  FORBIDDEN_SANDBOX_ENV_KEYS,
  getSandboxDriver,
  type SandboxDriver,
  type SandboxJobMode,
} from "@/lib/sandbox/config";
import { runDockerSandboxJob } from "@/lib/sandbox/docker";
import { runVercelSandboxJob } from "@/lib/sandbox/vercel";
import type { SandboxSubAgentResult } from "@/lib/sandbox/result";

export type SandboxSmokeJobRequest = {
  prompt?: string;
  mode?: SandboxJobMode;
};

export type SandboxSmokeJobResult = {
  ok: true;
  driver: SandboxDriver;
  subAgentResult: SandboxSubAgentResult;
  durationMs: number;
};

const DEFAULT_SMOKE_PROMPT =
  "Confirm that this Studio 24 sandboxed sub-agent can receive a task and return a short result.";

export async function runSandboxSmokeJob(
  request: SandboxSmokeJobRequest = {},
): Promise<SandboxSmokeJobResult> {
  const driver = getSandboxDriver();
  const mode = request.mode ?? "live";
  assertSandboxReadyForMode(mode);

  const input = {
    jobType: "subagent_smoke" as const,
    prompt: request.prompt?.trim() || DEFAULT_SMOKE_PROMPT,
    mode,
    expectedForbiddenEnv: [...FORBIDDEN_SANDBOX_ENV_KEYS],
  };

  const startedAt = Date.now();
  const workerResult =
    driver === "docker"
      ? await runDockerSandboxJob(input)
      : await runVercelSandboxJob(input);

  return {
    ok: true,
    driver,
    subAgentResult: workerResult.subAgentResult,
    durationMs: Date.now() - startedAt,
  };
}
