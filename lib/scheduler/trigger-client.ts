/**
 * Trigger.dev integration for scheduled message jobs.
 *
 * Setup:
 *   1. Install: npm install @trigger.dev/sdk
 *   2. Add TRIGGER_API_KEY and TRIGGER_PROJECT_ID to .env.local
 *   3. Run: npx trigger.dev@latest dev
 *
 * The scheduled task below runs every minute and processes due jobs from SQLite.
 */

import { schedules } from '@trigger.dev/sdk/v3'
import { processPendingJobs } from './jobs'

export const scheduledJobRunner = schedules.task({
  id: 'process-scheduled-messages',
  // Runs every minute
  cron: '* * * * *',
  run: async () => {
    const result = await processPendingJobs()
    console.log(`[trigger] Processed: ${result.sent} sent, ${result.failed} failed`)
    return result
  },
})
