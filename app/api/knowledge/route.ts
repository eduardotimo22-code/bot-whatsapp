import { NextResponse } from 'next/server'
import { listKBEntries, syncKBFromSheets } from '@/lib/sheets/knowledge'

export async function GET() {
  try {
    const entries = await listKBEntries()
    return NextResponse.json(entries)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// Force re-sync from Google Sheets
export async function PUT() {
  try {
    await syncKBFromSheets()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
