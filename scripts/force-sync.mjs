import { google } from 'googleapis'
import Database from 'better-sqlite3'
import { nanoid } from 'nanoid'
import { config } from 'dotenv'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

config({ path: '.env' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const auth = new google.auth.JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})

const sheets = google.sheets({ version: 'v4', auth })
const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID

async function main() {
  console.log('📥 Leyendo Hoja "Conocimiento" desde Google Sheets...')
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Conocimiento!A2:D',
  })

  const rows = res.data.values ?? []
  console.log(`   ${rows.length} filas encontradas en Sheets`)
  rows.slice(0, 3).forEach(([q]) => console.log('  •', q?.substring(0, 55)))

  console.log('\n💾 Escribiendo en SQLite...')
  const db = new Database(join(ROOT, 'data', 'bot.db'))
  db.pragma('journal_mode = WAL')

  db.prepare('DELETE FROM kb_cache').run()

  const insert = db.prepare(
    'INSERT INTO kb_cache (id, question, answer, category, active, synced_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)'
  )

  const sync = db.transaction(() => {
    for (const [question, answer, category] of rows) {
      if (!question?.trim() || !answer?.trim()) continue
      insert.run(nanoid(), question.trim(), answer.trim(), category?.trim() ?? '')
    }
  })
  sync()

  const count = db.prepare('SELECT COUNT(*) as c FROM kb_cache').get()
  console.log(`✅ ${count.c} entradas guardadas en SQLite`)

  const sample = db.prepare('SELECT question, category FROM kb_cache LIMIT 4').all()
  sample.forEach(r => console.log('  •', r.question.substring(0, 55), '|', r.category))

  db.close()
}

main().catch(console.error)
