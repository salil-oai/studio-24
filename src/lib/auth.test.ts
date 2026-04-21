import { describe, expect, it, vi } from "vitest";
import {
  createAuthToken,
  isPasswordValid,
  verifyAuthToken,
} from "@/lib/auth";

describe("auth", () => {
  it("rejects invalid passwords", () => {
    vi.stubEnv("APP_PASSWORD", "correct horse battery staple");
    expect(isPasswordValid("wrong")).toBe(false);
  });

  it("accepts the configured password", () => {
    vi.stubEnv("APP_PASSWORD", "correct horse battery staple");
    expect(isPasswordValid("correct horse battery staple")).toBe(true);
  });

  it("creates and verifies signed session tokens", () => {
    vi.stubEnv("APP_SESSION_SECRET", "test-secret");
    const token = createAuthToken({ now: 1000 });
    expect(verifyAuthToken(token, { now: 1001 }).valid).toBe(true);
    expect(verifyAuthToken(`${token}tampered`, { now: 1001 }).valid).toBe(false);
  });
});
