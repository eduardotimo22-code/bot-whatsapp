-- Pizza Juniors Bot — Cloudflare D1 schema
-- Apply with: wrangler d1 execute pizza-juniors-bot --file=schema.sql
-- Local:      wrangler d1 execute pizza-juniors-bot --local --file=schema.sql

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,          -- equals phone (normalized, no +)
  phone TEXT NOT NULL,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  turns_reset_at DATETIME,
  last_message_at DATETIME,
  escalated_at DATETIME,
  paused_until DATETIME,
  offhours_notified_date TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  ycloud_message_id TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
-- UNIQUE: la deduplicación de mensajes entrantes depende de INSERT OR IGNORE sobre este índice
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_ycloud ON messages(ycloud_message_id)
  WHERE ycloud_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS kb_cache (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  items TEXT NOT NULL,
  total REAL,
  source TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'pending',
  delivery_type TEXT,
  address TEXT,
  payment_method TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
