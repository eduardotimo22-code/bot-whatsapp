import { NextRequest, NextResponse } from 'next/server'
import { listWhatsAppGroups, addWhatsAppGroup, deleteWhatsAppGroup } from '@/lib/ycloud/groups'

export async function GET() {
  try {
    const groups = listWhatsAppGroups()
    return NextResponse.json(groups)
  } catch (err) {
    console.error('[api/groups] GET error:', err)
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, jid } = await request.json() as { name: string; jid: string }
    if (!name?.trim() || !jid?.trim()) {
      return NextResponse.json({ error: 'name and jid are required' }, { status: 400 })
    }
    const group = addWhatsAppGroup(name.trim(), jid.trim())
    return NextResponse.json(group)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'error'
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Este JID ya está registrado' }, { status: 409 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json() as { id: string }
    deleteWhatsAppGroup(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/groups] DELETE error:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
