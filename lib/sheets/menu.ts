import { getSheetValues } from './client'
import { getDb } from '@/lib/db'

let menuCache: { text: string; fetchedAt: number } | null = null
const MENU_TTL_MS = 10 * 60 * 1000 // 10 minutes

export async function getMenuText(): Promise<string> {
  if (menuCache && Date.now() - menuCache.fetchedAt < MENU_TTL_MS) {
    return menuCache.text
  }

  const db = getDb()
  const spreadsheetId =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||
    (db.prepare("SELECT value FROM settings WHERE key = 'google_spreadsheet_id'").get() as { value: string } | undefined)?.value

  if (!spreadsheetId) {
    return '🍕 *MENÚ PIZZA JUNIORS*\n\nConsulta nuestro menú en pizzajuniorcozumel.com o escríbenos para más información.'
  }

  try {
    // Tab "Menu": Categoría | Producto | Descripción | Precio | Disponible
    const rows = await getSheetValues(spreadsheetId, 'Menu!A2:E')

    // Group by category
    const byCategory = new Map<string, Array<{ name: string; description: string; price: string }>>()

    for (const [category, name, description, price, available] of rows) {
      if (!name?.trim()) continue
      const isAvailable = available?.toString().toUpperCase() !== 'FALSE' && available?.toString().toUpperCase() !== 'NO'
      if (!isAvailable) continue

      const cat = category?.trim() || 'Otros'
      if (!byCategory.has(cat)) byCategory.set(cat, [])
      byCategory.get(cat)!.push({
        name: name.trim(),
        description: description?.trim() ?? '',
        price: price?.trim() ?? '',
      })
    }

    if (byCategory.size === 0) {
      return '🍕 *MENÚ PIZZA JUNIORS*\n\nConsulta nuestro menú completo en pizzajuniorcozumel.com'
    }

    const CATEGORY_EMOJIS: Record<string, string> = {
      pizzas: '🍕',
      pizza: '🍕',
      bebidas: '🥤',
      bebida: '🥤',
      postres: '🍰',
      postre: '🍰',
      entradas: '🍟',
      ensaladas: '🥗',
      otros: '🍴',
    }

    const lines = ['🍕 *MENÚ PIZZA JUNIORS COZUMEL* 🍕', '']

    for (const [cat, items] of byCategory) {
      const emoji = CATEGORY_EMOJIS[cat.toLowerCase()] ?? '🍴'
      lines.push(`${emoji} *${cat.toUpperCase()}*`)
      for (const item of items) {
        const priceStr = item.price ? ` — $${item.price}` : ''
        lines.push(`• ${item.name}${priceStr}`)
        if (item.description) lines.push(`  _${item.description}_`)
      }
      lines.push('')
    }

    lines.push('_¿Listo para ordenar? Dime qué te apetece_ 😊')

    const text = lines.join('\n')
    menuCache = { text, fetchedAt: Date.now() }
    return text
  } catch (err) {
    console.error('[sheets/menu] Error fetching menu:', err)
    return '🍕 *MENÚ PIZZA JUNIORS*\n\nConsulta nuestro menú en pizzajuniorcozumel.com o escríbenos para más información.'
  }
}

export function invalidateMenuCache(): void {
  menuCache = null
}
