import { z } from "zod";

export const sandboxSubAgentResultSchema = z.object({
  mode: z.enum(["mock", "live"]),
  model: z.string().min(1),
  outputText: z.string(),
  sdkLoaded: z.boolean(),
  forbiddenEnvPresent: z.array(z.string()),
});

export const sandboxWorkerSuccessSchema = z.object({
  ok: z.literal(true),
  jobType: z.literal("subagent_smoke"),
  subAgentResult: sandboxSubAgentResultSchema,
  artifacts: z
    .array(
      z.object({
        name: z.string().min(1),
        path: z.string().min(1),
        mimeType: z.string().min(1).optional(),
        sizeBytes: z.number().int().nonnegative().optional(),
      }),
    )
    .default([]),
});

const sandboxWorkerErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string().min(1),
  details: z.string().optional(),
});

export type SandboxWorkerSuccess = z.infer<typeof sandboxWorkerSuccessSchema>;
export type SandboxSubAgentResult = z.infer<typeof sandboxSubAgentResultSchema>;

export function parseSandboxWorkerOutput(rawOutput: string): SandboxWorkerSuccess {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawOutput);
  } catch {
    throw new Error("Sandbox worker did not write valid JSON output.");
  }

  const parsedError = sandboxWorkerErrorSchema.safeParse(parsedJson);
  if (parsedError.success) {
    throw new Error(parsedError.data.details ?? parsedError.data.error);
  }

  const parsedSuccess = sandboxWorkerSuccessSchema.safeParse(parsedJson);
  if (!parsedSuccess.success) {
    throw new Error("Sandbox worker output did not match the expected schema.");
  }

  return parsedSuccess.data;
}
