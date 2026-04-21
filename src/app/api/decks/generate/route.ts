import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { generateDeckWithAgent } from "@/lib/agent/deck-agent";
import { saveDeckToHistory } from "@/lib/deck/history";
import { generateDeckRequestSchema } from "@/lib/deck/schema";
import { assertDeckStorageConfigured } from "@/lib/deck/storage";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!verifyAuthToken(authToken).valid) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = generateDeckRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Prompt must be between 8 and 8000 characters." },
      { status: 400 },
    );
  }

  try {
    requireEnv("OPENAI_API_KEY");
    assertDeckStorageConfigured();
    const deck = await generateDeckWithAgent(parsed.data.prompt);
    try {
      await saveDeckToHistory(deck);
    } catch (historyError) {
      console.warn("Could not save deck history.", historyError);
    }
    return NextResponse.json(deck);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Deck generation failed.",
      },
      { status: 500 },
    );
  }
}
