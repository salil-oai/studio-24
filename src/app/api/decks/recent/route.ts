import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { listRecentDecks } from "@/lib/deck/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!verifyAuthToken(authToken).valid) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    return NextResponse.json(await listRecentDecks());
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load recent decks.",
      },
      { status: 500 },
    );
  }
}
