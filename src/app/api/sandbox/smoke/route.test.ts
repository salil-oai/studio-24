import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSandboxSmokeJob } from "@/lib/sandbox/runner";
import { POST } from "./route";

vi.mock("@/lib/auth", () => ({
  AUTH_COOKIE_NAME: "studio24_session",
  verifyAuthToken: vi.fn((token?: string) => ({
    valid: token === "valid-session",
  })),
}));

vi.mock("@/lib/sandbox/runner", () => ({
  runSandboxSmokeJob: vi.fn(),
}));

const mockedRunSandboxSmokeJob = vi.mocked(runSandboxSmokeJob);

function makeRequest(body: unknown, token?: string) {
  return new NextRequest("http://localhost/api/sandbox/smoke", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(token ? { cookie: `studio24_session=${token}` } : {}),
    },
  });
}

describe("sandbox smoke route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRunSandboxSmokeJob.mockResolvedValue({
      ok: true,
      driver: "docker",
      durationMs: 10,
      subAgentResult: {
        mode: "mock",
        model: "crest-alpha",
        outputText: "ok",
        sdkLoaded: true,
        forbiddenEnvPresent: [],
      },
    });
  });

  it("rejects unauthenticated requests", async () => {
    const response = await POST(makeRequest({ mode: "mock" }));

    expect(response.status).toBe(401);
    expect(mockedRunSandboxSmokeJob).not.toHaveBeenCalled();
  });

  it("runs the sandbox smoke job for authenticated requests", async () => {
    const response = await POST(makeRequest({ mode: "mock" }, "valid-session"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      driver: "docker",
      subAgentResult: {
        mode: "mock",
      },
    });
    expect(mockedRunSandboxSmokeJob).toHaveBeenCalledWith({ mode: "mock" });
  });

  it("rejects invalid smoke request bodies", async () => {
    const response = await POST(
      makeRequest({ mode: "unsafe" }, "valid-session"),
    );

    expect(response.status).toBe(400);
    expect(mockedRunSandboxSmokeJob).not.toHaveBeenCalled();
  });
});
