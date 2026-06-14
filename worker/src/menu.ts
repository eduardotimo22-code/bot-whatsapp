import type { Env } from './index'
import { getSheetValues } from './sheets'
import { getMenuItems, getMenuSyncAge, replaceMenuCache, type MenuItem } from './db'

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutos

// Texto de FALLBACK si el Sheet no está disponible. Sus precios deben coincidir con
// FALLBACK_TABLE en pricing.ts.
const MENU_TEXT = `🍕 *MENÚ PIZZA JUNIORS COZUMEL* 🍕

🎯 *PROMOCIONES* (¡NO SE ACEPTAN CAMBIOS!)
• *Promo #1* — $290: 1 Pizza grande pepperoni + 1 Pizza grande hawaiana
• *Promo #2* — $230: Pizza grande de 3 ingredientes + 1 pan A/Q + 1 coca 1.35 lt
• *Promo #3* — $205: Pizza grande de 1 ingrediente + 1 pan A/Q + 1 coca 1.35 lt

🍕 *ESPECIALIDADES* (Mediana / Grande)
• Margarita — $160 / $180
• Pepperoni — $160 / $180
• Champiñón — $160 / $180
• Hawaiana (jamón, piña) — $180 / $210
• Carnes Frías (jamón, salami, pepperoni, chorizo) — $195 / $220
• Junior's — $220 / $250
• 4 Quesos — $230 / $250

🧀 *EXTRAS*
• Ingrediente extra: $30
• Queso extra: $50
• Orilla de philadelphia: $50

🍞 *COMPLEMENTOS*
• Pan de ajo/queso (pan A/Q) — $40

💳 *FORMAS DE PAGO:* Efectivo, tarjeta y transferencia`

// Construye el texto del menú para el system prompt a partir de los items del Sheet.
// Junta las dos filas de tamaño de cada pizza ("X Mediana" / "X Grande") en una línea.
function buildMenuText(items: MenuItem[]): string {
  const avail = items.filter((i) => i.available)
  if (avail.length === 0) return MENU_TEXT

  const order: string[] = []
  const byCat = new Map<string, MenuItem[]>()
  for (const it of avail) {
    if (!byCat.has(it.category)) {
      byCat.set(it.category, [])
      order.push(it.category)
    }
    byCat.get(it.category)!.push(it)
  }

  const sizeRe = /\s+(mediana|grande)\s*$/i
  const lines: string[] = ['🍕 *MENÚ PIZZA JUNIORS COZUMEL* 🍕']

  for (const cat of order) {
    lines.push('', `*${cat}*`)
    const merged = new Map<string, { desc: string; mediana?: number; grande?: number }>()
    const mergedOrder: string[] = []
    const singles: MenuItem[] = []

    for (const it of byCat.get(cat)!) {
      const m = it.product.match(sizeRe)
      if (m && it.price != null) {
        const base = it.product.replace(sizeRe, '').trim()
        if (!merged.has(base)) {
          merged.set(base, { desc: it.description })
          mergedOrder.push(base)
        }
        const e = merged.get(base)!
        if (m[1].toLowerCase() === 'mediana') e.mediana = it.price
        else e.grande = it.price
        if (!e.desc && it.description) e.desc = it.description
      } else {
        singles.push(it)
      }
    }

    for (const base of mergedOrder) {
      const e = merged.get(base)!
      const desc = e.desc ? ` (${e.desc})` : ''
      const price = e.mediana != null && e.grande != null
        ? `Mediana $${e.mediana} / Grande $${e.grande}`
        : e.grande != null ? `$${e.grande}` : `$${e.mediana}`
      lines.push(`• ${base}${desc} — ${price}`)
    }
    for (const it of singles) {
      const desc = it.description ? ` (${it.description})` : ''
      const price = it.price != null ? ` — $${it.price}` : ''
      lines.push(`• ${it.product}${desc}${price}`)
    }
  }

  lines.push('', '💳 *FORMAS DE PAGO:* Efectivo, tarjeta y transferencia')
  return lines.join('\n')
}

export async function syncMenuFromSheets(env: Env): Promise<void> {
  if (!env.GOOGLE_SHEETS_SPREADSHEET_ID) return

  try {
    const rows = await getSheetValues(env, 'Menu!A2:E')
    const items: MenuItem[] = rows
      .filter((r) => r[1]?.trim()) // debe tener Producto
      .map(([category, product, description, price, available]) => ({
        category: category?.trim() ?? '',
        product: product.trim(),
        description: description?.trim() ?? '',
        price: price != null && price.toString().trim() !== ''
          ? parseFloat(price.toString().replace(/[^0-9.]/g, '')) || null
          : null,
        available: available?.toString().toUpperCase() !== 'FALSE' && available?.toString().toUpperCase() !== 'NO',
      }))

    if (items.length === 0) {
      console.warn('[menu] Sheet devolvió 0 items — conservando caché actual')
      return
    }

    await replaceMenuCache(env, items)
    console.log(`[menu] Synced ${items.length} menu items`)
  } catch (err) {
    console.error('[menu] Sync error:', err)
  }
}

async function syncMenuIfStale(env: Env): Promise<void> {
  if (!env.GOOGLE_SHEETS_SPREADSHEET_ID) return
  const age = await getMenuSyncAge(env)
  if (age < CACHE_TTL_MS) return
  await syncMenuFromSheets(env)
}

export async function getMenuText(env: Env): Promise<string> {
  try {
    await syncMenuIfStale(env)
    const items = await getMenuItems(env)
    if (items.length > 0) return buildMenuText(items)
  } catch (err) {
    console.error('[menu] getMenuText error — usando fallback:', err)
  }
  return MENU_TEXT
}
