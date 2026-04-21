import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isDeckHistoryConfigured,
  listRecentDecks,
  saveDeckToHistory,
} from "@/lib/deck/history";

describe("deck history", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is disabled when DATABASE_URL is not configured", async () => {
    vi.stubEnv("DATABASE_URL", "");

    expect(isDeckHistoryConfigured()).toBe(false);
    await expect(listRecentDecks()).resolves.toEqual({
      configured: false,
      decks: [],
    });
  });

  it("does not fail deck generation when history storage is unconfigured", async () => {
    vi.stubEnv("DATABASE_URL", "");

    await expect(
      saveDeckToHistory({
        title: "Test deck",
        slideCount: 4,
        blobUrl: "https://example.com/deck.pptx",
        fileName: "deck.pptx",
      }),
    ).resolves.toBeNull();
  });
});
