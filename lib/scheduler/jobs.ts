import { getDb } from '@/lib/db'
import { sendTextMessage, sendGroupMessage } from '@/lib/ycloud/sender'
import type { ScheduledJob } from '@/types'

/**
 * Processes all pending scheduled jobs that are due.
 * Called by the Trigger.dev scheduled task or manually via API.
 */
export async function processPendingJobs(): Promise<{ sent: number; failed: number }> {
  const db = getDb()

  const dueJobs = db.prepare(`
    SELECT * FROM scheduled_jobs
    WHERE status = 'pending' AND scheduled_at <= CURRENT_TIMESTAMP
    ORDER BY scheduled_at ASC
  `).all() as ScheduledJob[]

  let sent = 0
  let failed = 0

  for (const job of dueJobs) {
    try {
      if (job.target_type === 'broadcast') {
        const contacts = db.prepare("SELECT phone FROM contacts").all() as { phone: string }[]
        for (const contact of contacts) {
          await sendTextMessage(contact.phone, job.message)
        }
      } else if (job.target_type === 'group') {
        await sendGroupMessage(job.target_id, job.message)
      } else {
        await sendTextMessage(job.target_id, job.message)
      }

      db.prepare("UPDATE scheduled_jobs SET status = 'sent' WHERE id = ?").run(job.id)
      sent++
    } catch (err) {
      console.error(`[scheduler] Job ${job.id} failed:`, err)
      db.prepare("UPDATE scheduled_jobs SET status = 'failed' WHERE id = ?").run(job.id)
      failed++
    }
  }

  return { sent, failed }
}
