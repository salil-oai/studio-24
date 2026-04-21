import { readFile } from "node:fs/promises";
import { put } from "@vercel/blob";
import { BuiltDeck, PPTX_MIME_TYPE } from "@/lib/deck/pptx";
import { requireEnv } from "@/lib/env";

export type StoredDeck = {
  blobUrl: string;
  fileName: string;
  slideCount: number;
  title: string;
};

export async function uploadDeckToBlob(deck: BuiltDeck): Promise<StoredDeck> {
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
