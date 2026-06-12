import type { Env } from './index'

// Menú completo extraído de las fotos oficiales de Pizza Juniors Cozumel
const MENU_TEXT = `🍕 *MENÚ PIZZA JUNIORS COZUMEL* 🍕

🎯 *PROMOCIONES* (¡NO SE ACEPTAN CAMBIOS!)
• *Promo #1* — $290: 1 Pizza grande pepperoni + 1 Pizza grande hawaiana
• *Promo #2* — $230: Pizza grande de 3 ingredientes + 1 pan A/Q + 1 coca 1.35 lt
• *Promo #3* — $205: Pizza grande de 1 ingrediente + 1 pan A/Q + 1 coca 1.35 lt

🍕 *ESPECIALIDADES* (Mediana / Grande)

Básicas:
• Ajo (mantequilla de ajo) — $160 / $180
• Margarita — $160 / $180
• Pepperoni — $160 / $180
• Champiñón — $160 / $180

Clásicas:
• Hawaiana (jamón, piña) — $180 / $210
• Pecham (pepperoni, champiñón) — $180 / $210
• Jasa (jamón, salami) — $180 / $210
• Sacha (salami, champiñón) — $180 / $210
• Jacha (jamón, champiñón) — $180 / $210
• Picosita (chorizo, jalapeño) — $180 / $210

Especiales:
• Salchipotle (salsa chipotle asadera, cebolla) — $185 / $215
• Americana (jamón, salami, champiñón) — $185 / $215
• Carnes Frías (jamón, salami, pepperoni, chorizo) — $195 / $220
• Mexicana (salami, chorizo, cebolla, jalapeño) — $195 / $220
• Vegetariana (champiñón, cebolla, tomate, pimiento) — $195 / $220
• Honolulu (jamón, piña, tocino, jalapeño) — $195 / $220
• Extravagante (jamón, piña, chorizo, champiñón) — $195 / $220
• Volcánica (pepperoni, chorizo, cebolla, jalapeño) — $195 / $220
• Atún (atún, tomate, cebolla, jalapeño) — $195 / $220
• Italiana (salchicha pavo, cebolla, pimiento, tocino, mantequilla de ajo) — $205 / $225
• Ranchera (salami, frijol, chorizo, cebolla, jalapeño) — $205 / $225
• Norteña (salchicha asadera, frijol, cebolla, jalapeño, mantequilla de ajo) — $205 / $225
• Suprema (salami, pepperoni, chorizo, aceitunas, pimiento, cebolla) — $215 / $235
• Campestre (pepperoni, jamón, champiñón, tocino, pimiento, cebolla) — $215 / $235
• Junior's (jamón, salami, pepperoni, tocino, chorizo, champiñón, cebolla, pimiento, mantequilla de ajo) — $220 / $250
• Carnes Frías Especial (jamón, salami, pepperoni, chorizo, tocino, pavo, asadera) — $225 / $245
• Pastor (pastor, piña, cebolla, cilantro) — $225 / $245
• 4 Quesos (manchego, mozzarella, philadelphia, cheddar) — $230 / $250

🧀 *EXTRAS*
• Ingrediente extra: $30
• Queso extra: $50
• Orilla de philadelphia: $50

🍞 *COMPLEMENTOS*
• Pan de ajo/queso (pan A/Q) — $40

💳 *FORMAS DE PAGO:* Efectivo, tarjeta y transferencia`

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getMenuText(_env: Env): Promise<string> {
  return MENU_TEXT
}
