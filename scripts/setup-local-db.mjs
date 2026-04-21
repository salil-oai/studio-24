import fs from "node:fs";
import os from "node:os";
import postgres from "postgres";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;

  const text = fs.readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

loadEnvFile(".env.local");

const user = process.env.LOCAL_POSTGRES_USER || os.userInfo().username;
const host = process.env.LOCAL_POSTGRES_HOST || "localhost";
const port = process.env.LOCAL_POSTGRES_PORT || "5432";
const configuredAppUrl = process.env.DATABASE_URL;
const databaseName =
  process.env.LOCAL_DATABASE_NAME ||
  (configuredAppUrl ? new URL(configuredAppUrl).pathname.slice(1) : "studio24");
const maintenanceUrl =
  process.env.LOCAL_POSTGRES_URL || `postgres://${user}@${host}:${port}/postgres`;
const appUrl =
  configuredAppUrl || `postgres://${user}@${host}:${port}/${databaseName}`;

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

const maintenanceSql = postgres(maintenanceUrl, { max: 1 });

try {
  const databaseRows = await maintenanceSql`
    SELECT 1
    FROM pg_database
    WHERE datname = ${databaseName}
  `;

  if (databaseRows.length === 0) {
    await maintenanceSql.unsafe(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
  }
} finally {
  await maintenanceSql.end();
}

const appSql = postgres(appUrl, { max: 1 });

try {
  await appSql`
    CREATE TABLE IF NOT EXISTS deck_history (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slide_count INTEGER NOT NULL,
      blob_url TEXT NOT NULL UNIQUE,
      file_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await appSql`
    CREATE INDEX IF NOT EXISTS deck_history_created_at_idx
    ON deck_history (created_at DESC)
  `;

  const [status] = await appSql`
    SELECT
      current_database() AS database_name,
      current_user AS user_name,
      to_regclass('public.deck_history') AS deck_history_table
  `;

  console.log(
    JSON.stringify(
      {
        ok: true,
        databaseName: status.database_name,
        userName: status.user_name,
        deckHistoryTable: status.deck_history_table,
      },
      null,
      2,
    ),
  );
} finally {
  await appSql.end();
}
