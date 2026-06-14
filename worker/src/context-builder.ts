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
    '\n=== REGLAS DE PEDIDO Y DINERO (TIENEN PRIORIDAD SOBRE CUALQUIER INDICACIÓN ANTERIOR) ===',
    '\nDINERO — REGLA ABSOLUTA: NUNCA escribas cantidades en pesos, ni el símbolo $, ni precios, ni subtotales, ni totales, ni el cambio. El SISTEMA calcula y muestra TODOS los montos automáticamente. Tú solo describes productos, tamaños, cantidades e ingredientes. Si el cliente pregunta "¿cuánto es?" o un precio, NO lo calcules ni lo escribas: sigue armando el pedido con normalidad y el sistema mostrará el monto correcto debajo de tu mensaje.',
    '\nNUNCA inventes productos, ingredientes ni disponibilidad. Usa SOLO el menú y la base de conocimiento. NUNCA agregues productos que el cliente no pidió.',
    '\nPRODUCTOS Y EXTRAS:',
    '- Las pizzas se piden por su especialidad del menú (Pepperoni, Hawaiana, etc.) y su tamaño (mediana o grande). Incluye SIEMPRE el tamaño.',
    '- Ingrediente extra (uno que la especialidad NO trae): se marca DENTRO del item con "+". Ej: "Margarita +jamon +tocino". Cada "+" es un ingrediente extra.',
    '- Orilla de philadelphia y queso extra se escriben tal cual: "con orilla philadelphia", "con queso extra".',
    '- Pizza armada por el cliente: usa como base la especialidad más parecida (o Margarita si es solo queso) y agrega cada ingrediente con "+".',
    '- Refrescos / Coca Cola: disponibles según existencia (escríbelos como "1x Refresco"). El ENVÍO A DOMICILIO ES GRATIS.',
    '- Las PROMOS van como UN solo item ("1x Promo #1") SIN desglosar lo que incluyen (su pan y refresco ya están dentro; no los listes aparte).',
    '\nResponde siempre en el mismo idioma que el cliente.',
    '\nCARRITO — en CADA respuesta donde el pedido tenga uno o más productos (aunque NO esté confirmado todavía), incluye al FINAL esta línea exacta (el cliente NO la ve; el sistema la usa para calcular y mostrar el subtotal):',
    '[CARRITO: items=LISTA]',
    '- items: cada producto con cantidad "Nx", tamaño y extras, separados por " | ".',
    '\nPEDIDO CONFIRMADO — cuando el cliente confirme con SÍ, en lugar del CARRITO incluye al FINAL esta línea exacta (tampoco se la muestres al cliente):',
    '[PEDIDO_CONFIRMADO: nombre=NOMBRE, items=LISTA, tipo=entrega|recoger, pago=efectivo|tarjeta|transferencia, direccion=DIRECCION]',
    '- items: mismo formato que el CARRITO.',
    '- nombre: nombre completo del cliente tal como lo dio.',
    '- tipo: exactamente "entrega" o "recoger".',
    '- pago: exactamente "efectivo", "tarjeta" o "transferencia" (a DOMICILIO no hay tarjeta).',
    '- direccion: VA AL FINAL. Si tipo=entrega, la dirección completa con referencias tal como la dio el cliente (puede llevar comas). Si tipo=recoger, escribe exactamente "N/A". NUNCA confirmes una entrega sin dirección.',
    '\nEjemplos:',
    '[CARRITO: items=1x Pizza grande Pepperoni con orilla philadelphia | 1x Pizza grande Champiñón]',
    '[CARRITO: items=2x Promo #1 | 1x Pizza mediana Margarita +jamon +tocino | 1x Refresco]',
    '[PEDIDO_CONFIRMADO: nombre=Sonia, items=1x Pizza grande Hawaiana con orilla philadelphia | 1x Pizza grande Champiñón, tipo=recoger, pago=efectivo, direccion=N/A]',
  ].join('\n')

  return { systemPrompt, history, latestMessage }
}
