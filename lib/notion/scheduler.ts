import { getNotionClient } from './client'
import { getDb } from '@/lib/db'
import type { ScheduledJob } from '@/types'

function getDbId(): string | null {
  const db = getDb()
  return (db.prepare("SELECT value FROM settings WHERE key = 'notion_scheduled_db_id'").get() as { value: string } | undefined)?.value || null
}

const statusLabel: Record<string, string> = {
  pending:   'Pendiente',
  sent:      'Enviado',
  failed:    'Fallido',
  cancelled: 'Cancelado',
}

const typeLabel: Record<string, string> = {
  contact:   'Contacto',
  group:     'Grupo',
  broadcast: 'Broadcast',
}

export async function pushJobToNotion(job: ScheduledJob): Promise<string | null> {
  const dbId = getDbId()
  if (!dbId) return null

  try {
    const notion = getNotionClient()
    const page = await notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        Mensaje:          { title: [{ text: { content: job.message.slice(0, 200) } }] },
        Destinatario:     { rich_text: [{ text: { content: job.target_name || job.target_id } }] },
        Tipo:             { select: { name: typeLabel[job.target_type] ?? job.target_type } },
        'Fecha programada': { date: { start: new Date(job.scheduled_at).toISOString() } },
        Estado:           { select: { name: statusLabel[job.status] ?? job.status } },
      },
    })

    const db = getDb()
    db.prepare('UPDATE scheduled_jobs SET notion_page_id = ? WHERE id = ?').run(page.id, job.id)
    return page.id
  } catch (err) {
    console.error('[notion/scheduler] Push error:', err)
    return null
  }
}

export async function updateJobStatusInNotion(jobId: string, status: string): Promise<void> {
  const db = getDb()
  const row = db.prepare('SELECT notion_page_id FROM scheduled_jobs WHERE id = ?').get(jobId) as { notion_page_id: string | null } | undefined
  if (!row?.notion_page_id) return

  try {
    const notion = getNotionClient()
    await notion.pages.update({
      page_id: row.notion_page_id,
      properties: {
        Estado: { select: { name: statusLabel[status] ?? status } },
      },
    })
  } catch (err) {
    console.error('[notion/scheduler] Update error:', err)
  }
}

export async function archiveJobInNotion(jobId: string): Promise<void> {
  const db = getDb()
  const row = db.prepare('SELECT notion_page_id FROM scheduled_jobs WHERE id = ?').get(jobId) as { notion_page_id: string | null } | undefined
  if (!row?.notion_page_id) return

  try {
    const notion = getNotionClient()
    await notion.pages.update({ page_id: row.notion_page_id, archived: true })
  } catch (err) {
    console.error('[notion/scheduler] Archive error:', err)
  }
}
