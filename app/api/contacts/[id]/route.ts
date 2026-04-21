import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { saveLeadToNotion } from '@/lib/notion/leads'

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()
  const body = await request.json() as { name?: string; email?: string; interest?: string }

  db.prepare(
    'UPDATE contacts SET name = ?, email = ?, interest = ? WHERE id = ?'
  ).run(body.name ?? null, body.email ?? null, body.interest ?? null, id)

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()
  db.prepare('DELETE FROM contacts WHERE id = ?').run(id)
  return NextResponse.json({ ok: true })
}

// Push contact to Notion as lead
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const db = getDb()
  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) as {
    id: string; phone: string; name: string | null; email: string | null; interest: string | null; notion_page_id: string | null
  } | undefined

  if (!contact) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (contact.notion_page_id) return NextResponse.json({ error: 'already in Notion' }, { status: 409 })

  await saveLeadToNotion({
    contactId: contact.id,
    phone: contact.phone,
    name: contact.name,
    email: contact.email,
    interest: contact.interest,
  })

  const updated = db.prepare('SELECT notion_page_id FROM contacts WHERE id = ?').get(id) as { notion_page_id: string | null }
  return NextResponse.json({ ok: true, notion_page_id: updated.notion_page_id })
}
