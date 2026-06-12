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
  try { db.exec("CREATE TABLE IF NOT EXISTS kb_cache (id TEXT PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)") } catch { /* already exists */ }
  try { db.exec("ALTER TABLE conversations ADD COLUMN turns_reset_at DATETIME") } catch { /* already exists */ }
  try { db.exec("CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, items TEXT NOT NULL, total REAL, source TEXT NOT NULL DEFAULT 'whatsapp', status TEXT NOT NULL DEFAULT 'pending', delivery_type TEXT, address TEXT, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)") } catch { /* already exists */ }
  // Remove old conflicting [PEDIDO_CONFIRMADO] tag format from system_prompt setting
  try {
    const sp = db.prepare("SELECT value FROM settings WHERE key = 'system_prompt'").get() as { value: string } | undefined
    if (sp?.value?.includes('[PEDIDO_CONFIRMADO: items={')) {
      const cleaned = sp.value.replace(/\n?- Cuando el cliente confirme un pedido[\s\S]*?\[PEDIDO_CONFIRMADO[^\]]+\]/g, '').trim()
      db.prepare("UPDATE settings SET value = ? WHERE key = 'system_prompt'").run(cleaned)
    }
  } catch { /* ignore */ }

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
    ['bot_name', 'Junior'],
    ['tone', 'amigable, rápido y entusiasta con la comida'],
    ['system_prompt', `Eres Junior, el asistente virtual de Pizza Juniors Cozumel. Eres amigable, rápido y entusiasmado con la comida.

REGLAS:
- Responde siempre en español (salvo que el cliente hable inglés)
- Cuando el cliente pida el menú, dile que lo estás enviando y usa el flujo de menú automático
- Para hacer un pedido: guía al cliente item por item, confirma el total y pregunta si es para entrega o recoger
- Cuando el cliente confirme un pedido con SÍ, incluye al final de tu respuesta: [PEDIDO_CONFIRMADO: items={lista de items}, total={total}, tipo={entrega/recoger}]
- Horario: Lunes a Sábado 11am-11pm, Domingo 12pm-10pm (hora de Cozumel)
- Tiempo de entrega: 30-45 minutos
- Entrega a domicilio disponible en Cozumel
- Si el cliente tiene una queja o problema serio, escala inmediatamente al manager
- Si no sabes algo, dí: "Déjame preguntar al equipo y te aviso en un momento"`],
    ['business_hours_start', '11:00'],
    ['business_hours_end', '23:00'],
    ['business_days', JSON.stringify(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])],
    ['escalation_keywords', JSON.stringify(['hablar con alguien', 'hablar con una persona', 'queja', 'devolución', 'muy tarde', 'llegó mal', 'problema grave'])],
    ['escalation_after_turns', '10'],
    ['google_spreadsheet_id', ''],
    ['orders_api_key', ''],
    ['owner_phone', ''],
    ['appointment_notification_phone', ''],
  ]

  for (const [key, value] of defaults) {
    insert.run(key, value)
  }
}
