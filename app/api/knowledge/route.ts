import { NextRequest, NextResponse } from 'next/server'
import { listKBEntries, createKBEntry, syncKBFromNotion } from '@/lib/notion/knowledge'

export async function GET() {
  try {
    const entries = await listKBEntries()
    return NextResponse.json(entries)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { question: string; answer: string; category: string }
    const entry = await createKBEntry(body)
    return NextResponse.json(entry, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Force re-sync from Notion
export async function PUT() {
  try {
    await syncKBFromNotion()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
