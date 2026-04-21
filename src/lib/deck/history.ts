import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { getOptionalEnv } from "@/lib/env";
import type { StoredDeck } from "@/lib/deck/storage";

const RECENT_DECK_LIMIT = 4;

type SqlClient = ReturnType<typeof neon>;

type DeckHistoryRow = {
  id: string;
  title: string;
  slide_count: number;
  blob_url: string;
  file_name: string;
  created_at: string;
};

export type DeckHistoryItem = StoredDeck & {
  id: string;
  createdAt: string;
};

export type DeckHistoryResult = {
  configured: boolean;
  decks: DeckHistoryItem[];
};

let tableReady: Promise<void> | null = null;

function getSqlClient(): SqlClient | null {
  const databaseUrl = getOptionalEnv("DATABASE_URL");
  return databaseUrl ? neon(databaseUrl) : null;
}

function mapDeckHistoryRow(row: DeckHistoryRow): DeckHistoryItem {
  return {
    id: row.id,
    title: row.title,
    slideCount: Number(row.slide_count),
    blobUrl: row.blob_url,
    fileName: row.file_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function ensureDeckHistoryTable(sql: SqlClient): Promise<void> {
  tableReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS deck_history (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slide_count INTEGER NOT NULL,
        blob_url TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS deck_history_created_at_idx
      ON deck_history (created_at DESC)
    `;
  })();

  try {
    await tableReady;
  } catch (error) {
    tableReady = null;
    throw error;
  }
}

export function isDeckHistoryConfigured(): boolean {
  return Boolean(getOptionalEnv("DATABASE_URL"));
}

export async function saveDeckToHistory(
  deck: StoredDeck,
): Promise<DeckHistoryItem | null> {
  const sql = getSqlClient();
  if (!sql) return null;

  await ensureDeckHistoryTable(sql);

  const rows = (await sql`
    INSERT INTO deck_history (
      id,
      title,
      slide_count,
      blob_url,
      file_name
    )
    VALUES (
      ${randomUUID()},
      ${deck.title},
      ${deck.slideCount},
      ${deck.blobUrl},
      ${deck.fileName}
    )
    ON CONFLICT (blob_url) DO UPDATE
      SET title = EXCLUDED.title,
          slide_count = EXCLUDED.slide_count,
          file_name = EXCLUDED.file_name
    RETURNING id, title, slide_count, blob_url, file_name, created_at
  `) as DeckHistoryRow[];

  return rows[0] ? mapDeckHistoryRow(rows[0]) : null;
}

export async function listRecentDecks(
  limit = RECENT_DECK_LIMIT,
): Promise<DeckHistoryResult> {
  const sql = getSqlClient();
  if (!sql) {
    return { configured: false, decks: [] };
  }

  await ensureDeckHistoryTable(sql);

  const requestedLimit = Number.isFinite(limit)
    ? Math.trunc(limit)
    : RECENT_DECK_LIMIT;
  const safeLimit = Math.max(1, Math.min(requestedLimit, 20));
  const rows = (await sql`
    SELECT id, title, slide_count, blob_url, file_name, created_at
    FROM deck_history
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `) as DeckHistoryRow[];

  return {
    configured: true,
    decks: rows.map(mapDeckHistoryRow),
  };
}
