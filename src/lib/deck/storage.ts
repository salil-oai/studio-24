import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import { BuiltDeck, PPTX_MIME_TYPE } from "@/lib/deck/pptx";
import { getOptionalEnv, requireEnv } from "@/lib/env";

export type StoredDeck = {
  blobUrl: string;
  fileName: string;
  slideCount: number;
  title: string;
};

type DeckStorageDriver = "local" | "vercel-blob";

const DEFAULT_LOCAL_DECK_DIR = "public/generated/decks";
const DEFAULT_LOCAL_PUBLIC_BASE_URL = "/generated/decks";

export function getDeckStorageDriver(): DeckStorageDriver {
  const configuredDriver = getOptionalEnv("DECK_STORAGE_DRIVER");
  if (configuredDriver === "local" || configuredDriver === "vercel-blob") {
    return configuredDriver;
  }

  return getOptionalEnv("VERCEL") ? "vercel-blob" : "local";
}

export function assertDeckStorageConfigured(): void {
  if (getDeckStorageDriver() === "vercel-blob") {
    requireEnv("BLOB_READ_WRITE_TOKEN");
  }
}

function getLocalDeckStorageDir(): string {
  const configuredDir =
    getOptionalEnv("LOCAL_DECK_STORAGE_DIR") ?? DEFAULT_LOCAL_DECK_DIR;

  return path.isAbsolute(configuredDir)
    ? configuredDir
    : path.join(/* turbopackIgnore: true */ process.cwd(), configuredDir);
}

function getLocalDeckUrl(fileName: string): string {
  const publicBaseUrl =
    getOptionalEnv("LOCAL_DECK_PUBLIC_BASE_URL") ??
    DEFAULT_LOCAL_PUBLIC_BASE_URL;
  const cleanBaseUrl = publicBaseUrl.replace(/\/+$/, "");

  return `${cleanBaseUrl}/${encodeURIComponent(fileName)}`;
}

async function storeDeckLocally(deck: BuiltDeck): Promise<StoredDeck> {
  const outputDir = getLocalDeckStorageDir();
  await mkdir(outputDir, { recursive: true });
  await copyFile(deck.filePath, path.join(outputDir, deck.fileName));

  return {
    blobUrl: getLocalDeckUrl(deck.fileName),
    fileName: deck.fileName,
    slideCount: deck.slideCount,
    title: deck.title,
  };
}

async function uploadDeckToBlob(deck: BuiltDeck): Promise<StoredDeck> {
  requireEnv("BLOB_READ_WRITE_TOKEN");
  const bytes = await readFile(deck.filePath);
  const blob = await put(`decks/${deck.fileName}`, bytes, {
    access: "public",
    addRandomSuffix: true,
    contentType: PPTX_MIME_TYPE,
  });

  return {
    blobUrl: blob.url,
    fileName: deck.fileName,
    slideCount: deck.slideCount,
    title: deck.title,
  };
}

export async function storeDeck(deck: BuiltDeck): Promise<StoredDeck> {
  assertDeckStorageConfigured();

  if (getDeckStorageDriver() === "local") {
    return storeDeckLocally(deck);
  }

  return uploadDeckToBlob(deck);
}
