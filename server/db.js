// SQLite storage (built into Node 22+, no native build needed)
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// On Railway, always keep data on the attached volume so a new deploy can't wipe it.
const VOLUME_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || '';
const DATA_DIR = VOLUME_DIR || process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const ON_RAILWAY = !!(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
const STORAGE_SAFE = !ON_RAILWAY || !!VOLUME_DIR;
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'wharf-invoices.db'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The app's own records, kept as JSON: config/settings, companies/<id>, invoices/<id>.
CREATE TABLE IF NOT EXISTS docs (
  col TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (col, id)
);
`);

const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;
const setSetting = (key, value) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value));

module.exports = { db, DATA_DIR, STORAGE_SAFE, getSetting, setSetting };
