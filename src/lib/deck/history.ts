import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import { getOptionalEnv } from "@/lib/env";
import type { StoredDeck } from "@/lib/deck/storage";

const RECENT_DECK_LIMIT = 4;

type QueryRows = Record<string, unknown>[];
type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<QueryRows>;

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

let tableReady:
  | {
      databaseUrl: string;
      promise: Promise<void>;
    }
  | null = null;
let localSqlClient: SqlClient | null = null;
let localSqlClientUrl: string | null = null;

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function getSqlClient(): SqlClient | null {
  const databaseUrl = getOptionalEnv("DATABASE_URL");
  if (!databaseUrl) return null;

  if (isLocalDatabaseUrl(databaseUrl)) {
    if (!localSqlClient || localSqlClientUrl !== databaseUrl) {
      localSqlClient = postgres(databaseUrl, { max: 1 }) as unknown as SqlClient;
      localSqlClientUrl = databaseUrl;
    }

    return localSqlClient;
  }

  return neon(databaseUrl) as SqlClient;
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

async function ensureDeckHistoryTable(
  sql: SqlClient,
  databaseUrl: string,
): Promise<void> {
  if (tableReady?.databaseUrl !== databaseUrl) {
    tableReady = {
      databaseUrl,
      promise: (async () => {
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
      })(),
    };
  }

  try {
    await tableReady.promise;
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
  const databaseUrl = getOptionalEnv("DATABASE_URL");
  const sql = getSqlClient();
  if (!databaseUrl || !sql) return null;

  await ensureDeckHistoryTable(sql, databaseUrl);

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
  const databaseUrl = getOptionalEnv("DATABASE_URL");
  const sql = getSqlClient();
  if (!databaseUrl || !sql) {
    return { configured: false, decks: [] };
  }

  await ensureDeckHistoryTable(sql, databaseUrl);

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
