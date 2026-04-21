import { NextResponse } from 'next/server'
import { processPendingJobs } from '@/lib/scheduler/jobs'

// POST /api/scheduler/run — manually trigger job processing
// Also used by Trigger.dev webhook if configured
export async function POST() {
  try {
    const result = await processPendingJobs()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[scheduler/run]', err)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
