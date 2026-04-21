import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  clearAuthCookie,
  createAuthToken,
  isPasswordValid,
  setAuthCookie,
} from "@/lib/auth";

export const runtime = "nodejs";

const authRequestSchema = z.object({
  password: z.string().min(1).max(500),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = authRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  if (!isPasswordValid(parsed.data.password)) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  try {
    const response = NextResponse.json({ ok: true });
    setAuthCookie(response, createAuthToken());
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Authentication is not configured.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response);
  return response;
}
