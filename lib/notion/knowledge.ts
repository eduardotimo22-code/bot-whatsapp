import { getNotionClient } from './client'
import { getDb } from '@/lib/db'

export interface KnowledgeEntry {
  title: string
  answer: string
  category: string
}

/**
 * Queries the Notion knowledge base for entries relevant to the user's message.
 * Returns up to 5 matching entries sorted by relevance.
 * Falls back to empty array if Notion is not configured.
 */
export async function queryKnowledgeBase(userMessage: string): Promise<KnowledgeEntry[]> {
  const db = getDb()
  const dbId = (db.prepare("SELECT value FROM settings WHERE key = 'notion_kb_db_id'").get() as { value: string } | undefined)?.value

  if (!dbId) return []

  try {
    const notion = getNotionClient()

    // Query all active entries — Notion doesn't have full-text search via API,
    // so we fetch active records and filter client-side by keyword overlap.
    const response = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: 'Activo',
        checkbox: { equals: true },
      },
      page_size: 50,
    })

    const entries: KnowledgeEntry[] = []

    for (const page of response.results) {
      if (page.object !== 'page') continue
      const props = (page as { properties: Record<string, unknown> }).properties

      const title = extractTitle(props)
      const answer = extractRichText(props, 'Respuesta') ?? extractRichText(props, 'Answer') ?? ''
      const category = extractSelect(props, 'Categoría') ?? extractSelect(props, 'Category') ?? ''

      if (!title || !answer) continue
      entries.push({ title, answer, category })
    }

    // Rank by keyword overlap with the user message
    const words = userMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    const ranked = entries
      .map((e) => {
        const haystack = `${e.title} ${e.category} ${e.answer}`.toLowerCase()
        const score = words.filter((w) => haystack.includes(w)).length
        return { ...e, score }
      })
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)

    return ranked.map(({ title, answer, category }) => ({ title, answer, category }))
  } catch (err) {
    console.error('[notion/knowledge] Error:', err)
    return []
  }
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
