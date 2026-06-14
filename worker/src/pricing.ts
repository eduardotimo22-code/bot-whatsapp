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
  refresco: number
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
  refresco: 38,
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
  let { pan, quesoExtra, ingredienteExtra, orilla, refresco } = FALLBACK_TABLE

  for (const it of items) {
    if (it.price == null) continue
    const n = norm(it.product)
    const cat = norm(it.category)

    // Bebidas (refresco / coca / agua): precio suelto
    if (cat.includes('bebida') || cat.includes('refresco') || /\b(refresco|coca|soda|agua)\b/.test(n)) {
      refresco = it.price
      continue
    }

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
    refresco,
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

// Bebidas sueltas (refresco / coca / agua). En promo NO se cobran aparte: el modelo
// no debe listarlas como item separado cuando ya van dentro de una promo.
function isBebida(n: string): boolean {
  return /\b(refresco|refrescos|coca|soda|agua)\b/.test(n)
}

// Cargo por extras de una pizza:
//  - orilla / borde de philadelphia → table.orilla
//  - queso extra → table.quesoExtra
//  - cada ingrediente extra → table.ingredienteExtra (cada uno marcado con "+" en el
//    item, ej. "Margarita +jamon +tocino"; también se acepta "<ingrediente> extra").
// Se opera sobre el texto CRUDO porque norm() elimina los "+".
function extrasCharge(raw: string, table: PriceTable): number {
  const s = raw.toLowerCase()
  let charge = 0
  if (/orilla|borde/.test(s)) charge += table.orilla
  if (/queso extra|extra queso/.test(s)) charge += table.quesoExtra

  const plusCount = (s.match(/\+/g) || []).length
  const quesoWords = (s.match(/queso extra|extra queso/g) || []).length
  const extraWords = (s.match(/\b(extra|adicional)\b/g) || []).length
  // max() evita doble conteo si el modelo escribe "+jamon" y "jamon extra" a la vez.
  // Se descuentan las ocurrencias de "queso extra" (ya cobradas como $50).
  const ingredientExtras = Math.max(plusCount, Math.max(0, extraWords - quesoWords))
  charge += ingredientExtras * table.ingredienteExtra
  return charge
}

function priceOneItem(raw: string, table: PriceTable, pizzasBySpecificity: PriceTable['pizzas']): { unitPrice: number; matched: boolean } {
  // La especialidad se matchea SOLO con la parte antes del primer "+", para que un
  // ingrediente extra ("+pepperoni") no haga que una Margarita se cobre como Pepperoni.
  const basePart = raw.split('+')[0]
  const n = norm(basePart)
  const nFull = norm(raw)

  // 1. Pan A/Q: va PRIMERO porque la pizza "Ajo" es substring de "pan de ajo".
  if (/\bpan\b/.test(n)) return { unitPrice: table.pan, matched: true }

  // 2. Bebida suelta
  if (isBebida(n)) return { unitPrice: table.refresco, matched: true }

  // 3. Promo (#1/#2/#3)
  if (nFull.includes('promo')) {
    const m = nFull.match(/#?\s*([123])\b/)
    if (m && table.promos[m[1]] != null) return { unitPrice: table.promos[m[1]], matched: true }
  }

  // 4. Pizza por especialidad + tamaño (default grande) + extras marcados.
  const isMediana = /\bmedian[ao]\b/.test(n)
  for (const p of pizzasBySpecificity) {
    if (n.includes(norm(p.name))) {
      const base = isMediana ? p.mediana : p.grande
      return { unitPrice: base + extrasCharge(raw, table), matched: true }
    }
  }

  // 5. Extras como item suelto (sin pizza en el texto)
  if (/orilla|borde/.test(nFull)) return { unitPrice: table.orilla, matched: true }
  if (/queso extra|extra queso/.test(nFull)) return { unitPrice: table.quesoExtra, matched: true }
  if (/ingrediente (extra|adicional)|(extra|adicional) ingrediente/.test(nFull)) return { unitPrice: table.ingredienteExtra, matched: true }

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
