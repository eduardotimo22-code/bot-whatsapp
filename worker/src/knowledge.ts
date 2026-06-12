import type { Env } from './index'
import { getSheetValues } from './sheets'
import { getKBEntries, getKBSyncAge, replaceKBCache } from './db'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

export interface KBResult {
  question: string
  answer: string
  category: string
}

export async function queryKnowledgeBase(env: Env, userMessage: string): Promise<KBResult[]> {
  await syncKBIfStale(env)

  const entries = await getKBEntries(env)
  const words = userMessage.toLowerCase().split(/\s+/).filter((w) => w.length > 2)

  return entries
    .map((e) => {
      const haystack = `${e.question} ${e.category} ${e.answer}`.toLowerCase()
      const score = words.filter((w) => haystack.includes(w)).length
      return { ...e, score }
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score: _s, id: _id, ...rest }) => rest)
}

async function syncKBIfStale(env: Env): Promise<void> {
  if (!env.GOOGLE_SHEETS_SPREADSHEET_ID) return
  const age = await getKBSyncAge(env)
  if (age < CACHE_TTL_MS) return
  await syncKBFromSheets(env)
}

export async function syncKBFromSheets(env: Env): Promise<void> {
  if (!env.GOOGLE_SHEETS_SPREADSHEET_ID) return

  try {
    const rows = await getSheetValues(env, 'Conocimiento!A2:D')
    const entries = rows
      .filter(([q, a]) => q?.trim() && a?.trim())
      .map(([question, answer, category, active]) => ({
        question: question.trim(),
        answer: answer.trim(),
        category: category?.trim() ?? '',
        active: active?.toString().toUpperCase() !== 'FALSE' && active?.toString().toUpperCase() !== 'NO',
      }))

    await replaceKBCache(env, entries)
    console.log(`[knowledge] Synced ${entries.length} KB entries`)
  } catch (err) {
    console.error('[knowledge] Sync error:', err)
  }
}
