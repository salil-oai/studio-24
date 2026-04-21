import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";
import { getOptionalEnv, requireEnv } from "@/lib/env";

export const AUTH_COOKIE_NAME = "studio24_session";
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 12;

type AuthPayload = {
  exp: number;
  iat: number;
};

type VerifyOptions = {
  now?: number;
};

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function hashSecret(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function getSessionSecret(): string {
  return requireEnv("APP_SESSION_SECRET");
}

export function isPasswordValid(candidate: string): boolean {
  const configuredPassword = getOptionalEnv("APP_PASSWORD");
  if (!configuredPassword) return false;

  const candidateHash = hashSecret(candidate);
  const configuredHash = hashSecret(configuredPassword);
  return timingSafeEqual(candidateHash, configuredHash);
}

export function createAuthToken(options: VerifyOptions = {}): string {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const payload: AuthPayload = {
    iat: now,
    exp: now + AUTH_MAX_AGE_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, getSessionSecret())}`;
}

export function verifyAuthToken(
  token: string | undefined,
  options: VerifyOptions = {},
): { valid: boolean; reason?: string } {
  if (!token) return { valid: false, reason: "missing" };

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return { valid: false, reason: "malformed" };
  }

  const configuredSecret = getOptionalEnv("APP_SESSION_SECRET");
  if (!configuredSecret) {
    return { valid: false, reason: "missing_secret" };
  }

  const expectedSignature = sign(encodedPayload, configuredSecret);
  if (!safeEqual(signature, expectedSignature)) {
    return { valid: false, reason: "bad_signature" };
  }

  try {
    const payload = JSON.parse(
      base64UrlDecode(encodedPayload).toString("utf8"),
    ) as AuthPayload;
    const now = options.now ?? Math.floor(Date.now() / 1000);
    if (!Number.isFinite(payload.exp) || payload.exp <= now) {
      return { valid: false, reason: "expired" };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "bad_payload" };
  }
}

export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: AUTH_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
