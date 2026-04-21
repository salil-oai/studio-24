import { describe, expect, it } from "vitest";
import { parseSandboxWorkerOutput } from "@/lib/sandbox/result";

describe("sandbox worker output parser", () => {
  it("parses valid worker output", () => {
    expect(
      parseSandboxWorkerOutput(
        JSON.stringify({
          ok: true,
          jobType: "subagent_smoke",
          subAgentResult: {
            mode: "mock",
            model: "crest-alpha",
            outputText: "ok",
            sdkLoaded: true,
            forbiddenEnvPresent: [],
          },
          artifacts: [],
        }),
      ),
    ).toMatchObject({
      ok: true,
      jobType: "subagent_smoke",
      subAgentResult: {
        mode: "mock",
        outputText: "ok",
      },
    });
  });

  it("rejects malformed JSON", () => {
    expect(() => parseSandboxWorkerOutput("not json")).toThrow(
      "valid JSON output",
    );
  });

  it("rejects worker error output", () => {
    expect(() =>
      parseSandboxWorkerOutput(
        JSON.stringify({
          ok: false,
          error: "Sandbox worker failed.",
          details: "bad input",
        }),
      ),
    ).toThrow("bad input");
  });

  it("rejects output with the wrong schema", () => {
    expect(() =>
      parseSandboxWorkerOutput(JSON.stringify({ ok: true })),
    ).toThrow("expected schema");
  });
});
