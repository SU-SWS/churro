import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.resolve(process.cwd(), 'acquia-cache.sqlite'));

// Create table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    timestamp INTEGER NOT NULL
  )
`);

export function getCache<T>(key: string, maxAgeMs: number): T | null {
  const row = db.prepare('SELECT value, timestamp FROM cache WHERE key = ?').get(key) as { value: string; timestamp: number } | undefined;
  if (row && Date.now() - row.timestamp < maxAgeMs) {
    return JSON.parse(row.value) as T;
  }
  return null;
}

export function setCache<T>(key: string, value: T) {
  db.prepare(
    'INSERT OR REPLACE INTO cache (key, value, timestamp) VALUES (?, ?, ?)'
  ).run(key, JSON.stringify(value), Date.now());
}