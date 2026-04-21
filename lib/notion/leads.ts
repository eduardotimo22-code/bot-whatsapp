import { getNotionClient } from './client'
import { getDb } from '@/lib/db'

export interface LeadData {
  phone: string
  name: string | null
  email: string | null
  interest: string | null
  contactId: string
}

/**
 * Saves a detected lead to the Notion leads database and updates the local SQLite record.
 */
export async function saveLeadToNotion(data: LeadData): Promise<void> {
  const db = getDb()
  const dbId = (db.prepare("SELECT value FROM settings WHERE key = 'notion_leads_db_id'").get() as { value: string } | undefined)?.value

  if (!dbId) return

  // Avoid duplicating leads already synced
  const existing = db.prepare('SELECT notion_page_id FROM contacts WHERE id = ?').get(data.contactId) as { notion_page_id: string | null } | undefined
  if (existing?.notion_page_id) return

  try {
    const notion = getNotionClient()

    const page = await notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        Nombre: { title: [{ text: { content: data.name || data.phone } }] },
        Teléfono: { rich_text: [{ text: { content: data.phone } }] },
        Email: { email: data.email ?? undefined } as unknown as never,
        Interés: { rich_text: [{ text: { content: data.interest ?? '' } }] },
        Fuente: { select: { name: 'WhatsApp' } },
        Fecha: { date: { start: new Date().toISOString() } },
      },
    })

    // Update local contact with Notion page reference
    db.prepare('UPDATE contacts SET notion_page_id = ? WHERE id = ?').run(page.id, data.contactId)
  } catch (err) {
    console.error('[notion/leads] Error saving lead:', err)
  }
}

/**
 * Detects lead signals from a message (email, strong interest keywords).
 * Returns extracted data if signals found, null otherwise.
 */
export function detectLeadSignals(message: string): { email: string | null; interest: string | null } | null {
  const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  const interestKeywords = ['comprar', 'precio', 'costo', 'cotización', 'cotizar', 'información', 'contratar', 'adquirir', 'interesado', 'quiero', 'necesito']
  const hasInterest = interestKeywords.some((kw) => message.toLowerCase().includes(kw))

  if (!emailMatch && !hasInterest) return null

  return {
    email: emailMatch?.[0] ?? null,
    interest: hasInterest ? message.slice(0, 200) : null,
  }
}
