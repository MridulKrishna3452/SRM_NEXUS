import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { ROOT, config } from './config.js';

const MIGRATIONS_DIR = path.join(ROOT, 'migrations');

let db;

export function openDb(file = config.databasePath) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new DatabaseSync(file);
  conn.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
  return conn;
}

export function getDb() {
  if (!db) {
    db = openDb();
    migrate(db);
  }
  return db;
}

export function closeDb() {
  if (db) { db.close(); db = undefined; }
}

/** Apply any pending migrations/*.sql files in filename order. Returns names applied. */
export function migrate(conn) {
  conn.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`);
  const done = new Set(conn.prepare('SELECT name FROM schema_migrations').all().map((r) => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    tx(conn, () => {
      conn.exec(sql);
      conn.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    });
    applied.push(file);
  }
  return applied;
}

/** Run fn inside a transaction on conn (defaults to the app db). */
export function tx(conn, fn) {
  if (typeof conn === 'function') { fn = conn; conn = getDb(); }
  conn.exec('BEGIN');
  try {
    const out = fn();
    conn.exec('COMMIT');
    return out;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}

export const nowIso = () => new Date().toISOString();

export const parseJson = (s, fallback = []) => {
  try { return JSON.parse(s); } catch { return fallback; }
};
