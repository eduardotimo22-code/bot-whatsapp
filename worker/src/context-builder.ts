import type { Env } from './index'
import { getSettings, getRecentMessages } from './db'
import { queryKnowledgeBase } from './knowledge'
import { getMenuText } from './menu'

export interface AiContext {
  systemPrompt: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  latestMessage: string
}

export async function buildContext(
  env: Env,
  conversationId: string,
  latestMessage: string,
  turnsResetAt?: string | null
): Promise<AiContext> {
  const [settings, messages, knowledgeEntries, menuText] = await Promise.all([
    getSettings(env),
    getRecentMessages(env, conversationId, 12, turnsResetAt),
    queryKnowledgeBase(env, latestMessage),
    getMenuText(env),
  ])

  // Exclude the last message (about to be processed)
  const history = messages
    .slice(0, -1)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const menuBlock = menuText
    ? `\n\nMENÚ COMPLETO (usa esto para responder sobre productos, precios y promos):\n${menuText}`
    : ''

  const knowledgeBlock = knowledgeEntries.length > 0
    ? `\n\nINFORMACIÓN ADICIONAL DE LA BASE DE CONOCIMIENTO:\n${knowledgeEntries
        .map((e) => `[${e.category ? e.category + '] ' : ''}${e.question}\n${e.answer}`)
        .join('\n\n')}`
    : ''

  const now = new Date()
  const localOpts = { timeZone: 'America/Cancun' } as const
  const timeStr = now.toLocaleTimeString('es', { ...localOpts, timeStyle: 'short' })
  const dayStr = now.toLocaleDateString('es', { ...localOpts, weekday: 'long' })

  const systemPrompt = [
    settings.system_prompt,
    `\nNombre del asistente: ${settings.bot_name}`,
    `Tono: ${settings.tone}`,
    `Hora actual: ${timeStr} (${dayStr})`,
    menuBlock,
    knowledgeBlock,
    '\nIMPORTANTE — PRECIOS: NUNCA inventes ni estimes precios, ingredientes ni disponibilidad. Usa ÚNICAMENTE los datos del menú y la base de conocimiento. Si no tienes el dato exacto, di: "No tengo ese dato, déjame verificarlo con el equipo."',
    '\nIMPORTANTE — PEDIDOS: NUNCA agregues productos que el cliente no pidió explícitamente. Lista SOLO lo que el cliente confirmó, con su cantidad. No rellenes el pedido con pizzas de ejemplo ni inventes items.',
    '\nEl TOTAL final lo calcula automáticamente el sistema a partir de los items confirmados; tu prioridad es identificar correctamente los productos, cantidades y tamaños, no la suma.',
    '\nResponde siempre en el mismo idioma que el cliente.',
    '\nCuando el cliente confirme su pedido con SÍ, incluye al FINAL de tu respuesta esta línea exacta (no se la muestres al cliente):',
    '[PEDIDO_CONFIRMADO: nombre=NOMBRE, items=LISTA, total=NUMERO, tipo=entrega|recoger, pago=efectivo|tarjeta|transferencia, direccion=DIRECCION]',
    '\nReglas estrictas para el tag:',
    '- nombre: nombre completo del cliente tal como lo dio al hacer el pedido',
    '- items: lista cada producto con cantidad usando "x". Separa varios productos con " | ". Incluye SIEMPRE el tamaño (mediana/grande).',
    '- items — EXTRAS OBLIGATORIOS: si una pizza lleva orilla/borde de queso o philadelphia, queso extra o ingredientes extra, escríbelo DENTRO del mismo item. NUNCA omitas un extra que el cliente pidió. Ej: "1x Pizza grande Hawaiana con orilla philadelphia". El sistema cobra el extra solo si aparece en el item.',
    '- total: OBLIGATORIO. Suma los precios exactos del menú según los productos, tamaños, extras y cantidades confirmadas. Nunca dejes este campo vacío ni uses estimados. Ejemplo: 760',
    '- tipo: exactamente "entrega" o "recoger"',
    '- pago: exactamente "efectivo", "tarjeta" o "transferencia"',
    '- direccion: VA AL FINAL. Si tipo=entrega, escribe la dirección completa con referencias tal como la dio el cliente (puede llevar comas). Si tipo=recoger, escribe exactamente "N/A". NUNCA confirmes un pedido a entrega sin tener la dirección.',
    '\nEjemplos de tag correcto:',
    '[PEDIDO_CONFIRMADO: nombre=Juan García, items=2x Promo #1 | 1x Pizza grande Pepperoni, total=760, tipo=entrega, pago=efectivo, direccion=Av. 35 #210 entre Calle 5 y 7, casa azul]',
    '[PEDIDO_CONFIRMADO: nombre=Sonia, items=1x Pizza grande Hawaiana con orilla philadelphia | 1x Pizza grande Champiñón, total=440, tipo=recoger, pago=efectivo, direccion=N/A]',
  ].join('\n')

  return { systemPrompt, history, latestMessage }
}
