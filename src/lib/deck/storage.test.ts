import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDeckStorageDriver, storeDeck } from "@/lib/deck/storage";

describe("deck storage", () => {
  let outputDir: string | null = null;

  afterEach(async () => {
    vi.unstubAllEnvs();
    if (outputDir) {
      await rm(outputDir, { recursive: true, force: true });
      outputDir = null;
    }
  });

  it("defaults to local storage outside Vercel", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("DECK_STORAGE_DRIVER", "");

    expect(getDeckStorageDriver()).toBe("local");
  });

  it("copies generated decks to the configured local public directory", async () => {
    outputDir = await mkdtemp(path.join(tmpdir(), "studio-24-storage-test-"));
    const sourceFile = path.join(outputDir, "source.pptx");
    const localDeckDir = path.join(outputDir, "public-generated");

    await writeFile(sourceFile, "pptx bytes");
    vi.stubEnv("DECK_STORAGE_DRIVER", "local");
    vi.stubEnv("LOCAL_DECK_STORAGE_DIR", localDeckDir);
    vi.stubEnv("LOCAL_DECK_PUBLIC_BASE_URL", "/generated/decks");

    const stored = await storeDeck({
      fileName: "test-deck.pptx",
      filePath: sourceFile,
      slideCount: 4,
      title: "Test Deck",
    });

    await expect(readFile(path.join(localDeckDir, "test-deck.pptx"), "utf8"))
      .resolves.toBe("pptx bytes");
    expect(stored).toEqual({
      blobUrl: "/generated/decks/test-deck.pptx",
      fileName: "test-deck.pptx",
      slideCount: 4,
      title: "Test Deck",
    });
  });
});
