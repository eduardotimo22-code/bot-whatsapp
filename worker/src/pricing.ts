import type { Env } from './index'
import { getMenuItems, type MenuItem } from './db'

// Cálculo de totales server-side: NO confiamos en la suma del modelo (gpt-4o-mini
// se equivoca: inventa productos, suma mal). El total autoritativo se calcula aquí.
//
// La tabla de precios se construye desde la pestaña "Menu" del Google Sheet
// (cacheada en menu_cache). Si el Sheet no está disponible, se usa FALLBACK_TABLE
// hardcodeada — los precios del fallback deben coincidir con menu.ts.

export interface PriceTable {
  pizzas: { name: string; mediana: number; grande: number }[]
  promos: Record<string, number>
  pan: number
  quesoExtra: number
  ingredienteExtra: number
  orilla: number
}

// Pizzas por especialidad (precio mediana / grande) — FALLBACK si el Sheet falla.
const FALLBACK_PIZZAS = [
  { name: 'Ajo', mediana: 160, grande: 180 },
  { name: 'Margarita', mediana: 160, grande: 180 },
  { name: 'Pepperoni', mediana: 160, grande: 180 },
  { name: 'Champiñón', mediana: 160, grande: 180 },
  { name: 'Hawaiana', mediana: 180, grande: 210 },
  { name: 'Pecham', mediana: 180, grande: 210 },
  { name: 'Jasa', mediana: 180, grande: 210 },
  { name: 'Sacha', mediana: 180, grande: 210 },
  { name: 'Jacha', mediana: 180, grande: 210 },
  { name: 'Picosita', mediana: 180, grande: 210 },
  { name: 'Salchipotle', mediana: 185, grande: 215 },
  { name: 'Americana', mediana: 185, grande: 215 },
  { name: 'Carnes Frías Especial', mediana: 225, grande: 245 },
  { name: 'Carnes Frías', mediana: 195, grande: 220 },
  { name: 'Mexicana', mediana: 195, grande: 220 },
  { name: 'Vegetariana', mediana: 195, grande: 220 },
  { name: 'Honolulu', mediana: 195, grande: 220 },
  { name: 'Extravagante', mediana: 195, grande: 220 },
  { name: 'Volcánica', mediana: 195, grande: 220 },
  { name: 'Atún', mediana: 195, grande: 220 },
  { name: 'Italiana', mediana: 205, grande: 225 },
  { name: 'Ranchera', mediana: 205, grande: 225 },
  { name: 'Norteña', mediana: 205, grande: 225 },
  { name: 'Suprema', mediana: 215, grande: 235 },
  { name: 'Campestre', mediana: 215, grande: 235 },
  { name: "Junior's", mediana: 220, grande: 250 },
  { name: 'Pastor', mediana: 225, grande: 245 },
  { name: '4 Quesos', mediana: 230, grande: 250 },
]

export const FALLBACK_TABLE: PriceTable = {
  pizzas: FALLBACK_PIZZAS,
  promos: { '1': 290, '2': 230, '3': 205 },
  pan: 40,
  quesoExtra: 50,
  ingredienteExtra: 30,
  orilla: 50,
}

export interface PricedItem {
  qty: number
  label: string
  unitPrice: number
  subtotal: number
}

export interface OrderTotal {
  total: number
  breakdown: PricedItem[]
  unmatched: string[]
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9#]+/g, ' ')
    .trim()
}

// Construye la tabla de precios desde las filas de la pestaña Menu del Sheet.
// Cada pizza viene en filas separadas por tamaño ("Pepperoni Mediana"/"Grande").
export function buildPriceTableFromItems(items: MenuItem[]): PriceTable {
  const pizzaMap = new Map<string, { name: string; mediana: number; grande: number }>()
  const promos: Record<string, number> = {}
  let { pan, quesoExtra, ingredienteExtra, orilla } = FALLBACK_TABLE

  for (const it of items) {
    if (it.price == null) continue
    const n = norm(it.product)
    const cat = norm(it.category)

    if (n.includes('promo')) {
      const m = n.match(/#?\s*([123])\b/)
      if (m) promos[m[1]] = it.price
      continue
    }

    if (cat.includes('extra') || cat.includes('complement')) {
      if (/\bpan\b/.test(n)) pan = it.price
      else if (n.includes('orilla') || n.includes('borde') || n.includes('philadelphia')) orilla = it.price
      else if (n.includes('queso')) quesoExtra = it.price
      else if (n.includes('ingrediente')) ingredienteExtra = it.price
      continue
    }

    // Pizza: separar tamaño del nombre base
    const isMediana = /\bmedian[ao]\b/.test(n)
    const base = it.product.replace(/\s+(mediana|grande)\s*$/i, '').trim()
    const key = norm(base)
    const e = pizzaMap.get(key) ?? { name: base, mediana: 0, grande: 0 }
    if (isMediana) e.mediana = it.price
    else e.grande = it.price
    pizzaMap.set(key, e)
  }

  const pizzas = [...pizzaMap.values()].map((p) => ({
    name: p.name,
    mediana: p.mediana || p.grande, // si solo hay un tamaño, úsalo para ambos
    grande: p.grande || p.mediana,
  }))

  return {
    pizzas: pizzas.length ? pizzas : FALLBACK_TABLE.pizzas,
    promos: Object.keys(promos).length ? promos : FALLBACK_TABLE.promos,
    pan,
    quesoExtra,
    ingredienteExtra,
    orilla,
  }
}

export async function getPriceTable(env: Env): Promise<PriceTable> {
  try {
    const items = await getMenuItems(env)
    if (items.length > 0) return buildPriceTableFromItems(items)
  } catch (err) {
    console.error('[pricing] getPriceTable error, using fallback:', err)
  }
  return FALLBACK_TABLE
}

// Extras que pueden venir como item aparte o pegados al nombre de la pizza
// ("Hawaiana con borde de philadelphia", "Pepperoni con queso extra").
function hasOrilla(n: string): boolean {
  return n.includes('orilla') || n.includes('borde')
}
function hasQuesoExtra(n: string): boolean {
  return n.includes('queso extra') || n.includes('extra queso')
}
function hasIngredienteExtra(n: string): boolean {
  return n.includes('ingrediente extra') || n.includes('extra ingrediente') || n.includes('ingrediente adicional')
}
function bundledExtras(n: string, table: PriceTable): number {
  return (hasOrilla(n) ? table.orilla : 0) + (hasQuesoExtra(n) ? table.quesoExtra : 0) + (hasIngredienteExtra(n) ? table.ingredienteExtra : 0)
}

function priceOneItem(raw: string, table: PriceTable, pizzasBySpecificity: PriceTable['pizzas']): { unitPrice: number; matched: boolean } {
  const n = norm(raw)

  // 1. Pan A/Q: va PRIMERO porque la pizza "Ajo" es substring de "pan de ajo".
  if (/\bpan\b/.test(n)) return { unitPrice: table.pan, matched: true }

  // 2. Promo (#1/#2/#3)
  if (n.includes('promo')) {
    const m = n.match(/#?\s*([123])\b/)
    if (m && table.promos[m[1]] != null) return { unitPrice: table.promos[m[1]], matched: true }
  }

  // 3. Pizza por especialidad + tamaño (default grande). Va ANTES que los extras
  // sueltos para que "Pizza con queso extra" no se cobre como solo el extra; los
  // extras pegados al nombre se suman al precio de la pizza.
  const isMediana = /\bmedian[ao]\b/.test(n)
  for (const p of pizzasBySpecificity) {
    if (n.includes(norm(p.name))) {
      const base = isMediana ? p.mediana : p.grande
      return { unitPrice: base + bundledExtras(n, table), matched: true }
    }
  }

  // 4. Otros extras como item suelto (sin pizza en el texto)
  if (hasOrilla(n)) return { unitPrice: table.orilla, matched: true }
  if (hasQuesoExtra(n)) return { unitPrice: table.quesoExtra, matched: true }
  if (hasIngredienteExtra(n)) return { unitPrice: table.ingredienteExtra, matched: true }

  return { unitPrice: 0, matched: false }
}

// Parsea "2x Promo #1 | 1x Pizza grande Pepperoni" y devuelve el total autoritativo.
// items que no matchean ningún producto se reportan en `unmatched` (el llamador decide
// el fallback). NUNCA inventa precios.
export function computeOrderTotal(itemsStr: string, table: PriceTable = FALLBACK_TABLE): OrderTotal {
  // Matchea el nombre más específico primero ("Carnes Frías Especial" antes que "Carnes Frías").
  const pizzasBySpecificity = [...table.pizzas].sort((a, b) => norm(b.name).length - norm(a.name).length)

  const chunks = itemsStr.split('|').map((c) => c.trim()).filter(Boolean)
  const breakdown: PricedItem[] = []
  const unmatched: string[] = []
  let total = 0

  for (const chunk of chunks) {
    const qtyMatch = chunk.match(/^\s*(\d+)\s*x\s*/i)
    const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1
    const rest = qtyMatch ? chunk.slice(qtyMatch[0].length) : chunk

    const { unitPrice, matched } = priceOneItem(rest, table, pizzasBySpecificity)
    if (!matched) {
      unmatched.push(chunk)
      continue
    }
    const subtotal = unitPrice * qty
    total += subtotal
    breakdown.push({ qty, label: rest.trim(), unitPrice, subtotal })
  }

  return { total, breakdown, unmatched }
}
