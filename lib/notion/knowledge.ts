import { getNotionClient } from './client'
import { getDb } from '@/lib/db'

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
  const dbId = (db.prepare("SELECT value FROM settings WHERE key = 'notion_kb_db_id'").get() as { value: string } | undefined)?.value
  if (!dbId) return

  const newest = db.prepare('SELECT MAX(synced_at) as ts FROM kb_cache').get() as { ts: string | null }
  const age = newest.ts ? Date.now() - new Date(newest.ts).getTime() : Infinity
  if (age < CACHE_TTL_MS) return

  await syncKBFromNotion(dbId)
}

export async function syncKBFromNotion(dbId?: string): Promise<void> {
  const db = getDb()
  const resolvedId = dbId ?? (db.prepare("SELECT value FROM settings WHERE key = 'notion_kb_db_id'").get() as { value: string } | undefined)?.value
  if (!resolvedId) return

  try {
    const notion = getNotionClient()
    const response = await notion.databases.query({
      database_id: resolvedId,
      page_size: 100,
    })

    const upsert = db.prepare(
      'INSERT OR REPLACE INTO kb_cache (id, question, answer, category, active, synced_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    )
    const sync = db.transaction(() => {
      for (const page of response.results) {
        if (page.object !== 'page') continue
        const props = (page as { properties: Record<string, unknown> }).properties
        const question = extractTitle(props)
        const answer = extractRichText(props, 'Respuesta') ?? extractRichText(props, 'Answer') ?? ''
        const category = extractSelect(props, 'Categoría') ?? extractSelect(props, 'Category') ?? ''
        const active = extractCheckbox(props, 'Activo') ?? extractCheckbox(props, 'Active') ?? true
        if (!question || !answer) continue
        upsert.run(page.id, question, answer, category, active ? 1 : 0)
      }
    })
    sync()
  } catch (err) {
    console.error('[notion/knowledge] Sync error:', err)
  }
}

export async function listKBEntries(): Promise<KnowledgeEntry[]> {
  await syncKBIfStale()
  const db = getDb()
  return db.prepare('SELECT id, question, answer, category, active FROM kb_cache ORDER BY category, question').all() as KnowledgeEntry[]
}

export async function createKBEntry(data: { question: string; answer: string; category: string }): Promise<KnowledgeEntry> {
  const db = getDb()
  const dbId = (db.prepare("SELECT value FROM settings WHERE key = 'notion_kb_db_id'").get() as { value: string } | undefined)?.value
  if (!dbId) throw new Error('notion_kb_db_id not configured')

  const notion = getNotionClient()
  const page = await notion.pages.create({
    parent: { database_id: dbId },
    properties: {
      Pregunta: { title: [{ text: { content: data.question } }] },
      Respuesta: { rich_text: [{ text: { content: data.answer } }] },
      Categoría: { select: { name: data.category || 'General' } },
      Activo: { checkbox: true },
    },
  })

  db.prepare(
    'INSERT OR REPLACE INTO kb_cache (id, question, answer, category, active, synced_at) VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)'
  ).run(page.id, data.question, data.answer, data.category)

  return { id: page.id, question: data.question, answer: data.answer, category: data.category, active: true }
}

export async function updateKBEntry(id: string, data: { question: string; answer: string; category: string; active: boolean }): Promise<void> {
  const notion = getNotionClient()
  await notion.pages.update({
    page_id: id,
    properties: {
      Pregunta: { title: [{ text: { content: data.question } }] },
      Respuesta: { rich_text: [{ text: { content: data.answer } }] },
      Categoría: { select: { name: data.category || 'General' } },
      Activo: { checkbox: data.active },
    },
  })

  const db = getDb()
  db.prepare(
    'UPDATE kb_cache SET question = ?, answer = ?, category = ?, active = ?, synced_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(data.question, data.answer, data.category, data.active ? 1 : 0, id)
}

export async function deleteKBEntry(id: string): Promise<void> {
  const notion = getNotionClient()
  await notion.pages.update({ page_id: id, archived: true })

  const db = getDb()
  db.prepare('DELETE FROM kb_cache WHERE id = ?').run(id)
}

function extractTitle(props: Record<string, unknown>): string {
  for (const key of ['Pregunta', 'Tema', 'Title', 'Nombre', 'Name']) {
    const val = props[key] as { title?: Array<{ plain_text: string }> } | undefined
    if (val?.title?.[0]?.plain_text) return val.title[0].plain_text
  }
  return ''
}

function extractRichText(props: Record<string, unknown>, key: string): string | null {
  const val = props[key] as { rich_text?: Array<{ plain_text: string }> } | undefined
  if (!val?.rich_text?.length) return null
  return val.rich_text.map((r) => r.plain_text).join('')
}

function extractSelect(props: Record<string, unknown>, key: string): string | null {
  const val = props[key] as { select?: { name: string } } | undefined
  return val?.select?.name ?? null
}

function extractCheckbox(props: Record<string, unknown>, key: string): boolean | null {
  const val = props[key] as { checkbox?: boolean } | undefined
  return val?.checkbox ?? null
}
