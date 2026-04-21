import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'bot.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Run schema
  const schema = fs.readFileSync(path.join(process.cwd(), 'lib', 'db', 'schema.sql'), 'utf8')
  db.exec(schema)

  // Migrations
  try { db.exec("ALTER TABLE scheduled_jobs ADD COLUMN target_name TEXT") } catch { /* already exists */ }

  // Seed default settings if empty
  const count = (db.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number }).c
  if (count === 0) {
    seedDefaults(db)
  }

  return db
}

function seedDefaults(db: Database.Database) {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')

  const defaults: [string, string][] = [
    ['bot_name', 'Asistente'],
    ['tone', 'profesional y amable'],
    ['system_prompt', 'Eres un asistente de atención al cliente. Responde de forma clara y concisa basándote en la información disponible. Si no sabes algo, sé honesto y ofrece escalar al equipo humano.'],
    ['business_hours_start', '09:00'],
    ['business_hours_end', '18:00'],
    ['business_days', JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])],
    ['escalation_keywords', JSON.stringify(['hablar con alguien', 'hablar con una persona', 'agente', 'urgente', 'problema grave', 'queja'])],
    ['escalation_after_turns', '8'],
    ['notion_kb_db_id', ''],
    ['notion_conversations_db_id', ''],
    ['notion_leads_db_id', ''],
    ['owner_phone', ''],
    ['appointment_notification_phone', ''],
  ]

  for (const [key, value] of defaults) {
    insert.run(key, value)
  }
}
