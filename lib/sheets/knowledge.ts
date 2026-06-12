import { getSheetValues } from './client'
import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'

export interface KnowledgeEntry {
  id: string
  question: string
  answer: string
  category: string
  active: boolean
}

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function queryKnowledgeBase(userMessage: string): Promise<Omit<KnowledgeEntry, 'id' | 'active'>[]> {
  await syncKBIfStale()

  const db = getDb()
  const entries = db.prepare('SELECT id, question, answer, category FROM kb_cache WHERE active = 1').all() as Omit<KnowledgeEntry, 'active'>[]

  const words = userMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
  return entries
    .map((e) => {
      const haystack = `${e.question} ${e.category} ${e.answer}`.toLowerCase()
      const score = words.filter((w) => haystack.includes(w)).length
      return { ...e, score }
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ id: _id, score: _score, ...rest }) => rest)
}

export async function syncKBIfStale(): Promise<void> {
  const db = getDb()
  const spreadsheetId =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
    (db.prepare("SELECT value FROM settings WHERE key = 'google_spreadsheet_id'").get() as { value: string } | undefined)?.value
  if (!spreadsheetId) return

  const newest = db.prepare('SELECT MAX(synced_at) as ts FROM kb_cache').get() as { ts: string | null }
  const age = newest.ts ? Date.now() - new Date(newest.ts).getTime() : Infinity
  if (age < CACHE_TTL_MS) return

  await syncKBFromSheets(spreadsheetId)
}

export async function syncKBFromSheets(spreadsheetId?: string): Promise<void> {
  const db = getDb()
  const resolvedId =
    spreadsheetId ||
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
    (db.prepare("SELECT value FROM settings WHERE key = 'google_spreadsheet_id'").get() as { value: string } | undefined)?.value
  if (!resolvedId) return

  try {
    // Tab "Conocimiento": Pregunta | Respuesta | Categoría | Activo
    const rows = await getSheetValues(resolvedId, 'Conocimiento!A2:D')

    const upsert = db.prepare(
      'INSERT INTO kb_cache (id, question, answer, category, active, synced_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    )

    const sync = db.transaction(() => {
      // Clear all existing entries before inserting fresh data from Sheets
      db.prepare('DELETE FROM kb_cache').run()
      for (const [question, answer, category, active] of rows) {
        if (!question?.trim() || !answer?.trim()) continue
        const isActive = active?.toString().toUpperCase() !== 'FALSE' && active?.toString().toUpperCase() !== 'NO'
        upsert.run(nanoid(), question.trim(), answer.trim(), category?.trim() ?? '', isActive ? 1 : 0)
      }
    })
    sync()

    console.log(`[sheets/knowledge] Synced ${rows.length} KB entries from Google Sheets`)
  } catch (err) {
    console.error('[sheets/knowledge] Sync error:', err)
  }
}

export async function listKBEntries(): Promise<KnowledgeEntry[]> {
  await syncKBIfStale()
  const db = getDb()
  return db.prepare('SELECT id, question, answer, category, active FROM kb_cache ORDER BY category, question').all() as KnowledgeEntry[]
}
