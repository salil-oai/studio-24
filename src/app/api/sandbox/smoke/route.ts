import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { runSandboxSmokeJob } from "@/lib/sandbox/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sandboxSmokeRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(2000).optional(),
  mode: z.enum(["mock", "live"]).optional(),
});

async function readOptionalJson(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!verifyAuthToken(authToken).valid) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await readOptionalJson(request);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = sandboxSmokeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Sandbox smoke prompt or mode is invalid." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await runSandboxSmokeJob(parsed.data));
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Sandbox smoke test failed.",
      },
      { status: 500 },
    );
  }
}
