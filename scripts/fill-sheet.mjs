import { google } from 'googleapis'
import { config } from 'dotenv'

config({ path: '.env' })

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
const CLIENT_EMAIL = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
const PRIVATE_KEY = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n')

const auth = new google.auth.JWT({
  email: CLIENT_EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })

// ─── CONOCIMIENTO ────────────────────────────────────────────────────────────
const conocimiento = [
  ['Pregunta', 'Respuesta', 'Categoría', 'Activo'],
  ['horario cuándo abren', 'Estamos abiertos de lunes a sábado de 5pm a 11:30pm (hora de Cozumel). ¡Escríbenos dentro de ese horario! 🍕', 'General', 'TRUE'],
  ['ubicación dirección dónde están', 'Estamos en Cozumel, Quintana Roo. Búscanos como "Pizza Juniors Cozumel" en Google Maps o escríbenos para la dirección exacta. 📍', 'General', 'TRUE'],
  ['teléfono contacto', 'Puedes contactarnos por WhatsApp al 987-117-7992 o 987-100-8328. ¡Estamos para servirte! 😊', 'General', 'TRUE'],
  ['envío domicilio entrega', '¡Sí! Hacemos entrega a domicilio en Cozumel. 🛵 El tiempo estimado es de 30-45 minutos.', 'Pedidos', 'TRUE'],
  ['tiempo cuánto tarda', 'A domicilio: aproximadamente 30-45 minutos. Para recoger en tienda: 20-25 minutos. ⏱️', 'Pedidos', 'TRUE'],
  ['recoger en tienda', '¡Claro! Puedes pasar a recoger tu pedido directamente en nuestra tienda. Tu pizza estará lista en 20-25 minutos. 🏪', 'Pedidos', 'TRUE'],
  ['pago cómo pagan métodos', 'Aceptamos efectivo, tarjeta (crédito/débito) y transferencia bancaria. 💳', 'Pagos', 'TRUE'],
  ['precio cuánto cuesta pizzas', 'Nuestras especialidades van desde $160 (mediana) hasta $250 (grande). Escríbeme "menú" y te mando todas las opciones con precios exactos. 🍕', 'Precios', 'TRUE'],
  ['tamaños qué tamaños', 'Manejamos dos tamaños: Mediana y Grande. Escríbeme "menú" para ver todas las especialidades con sus precios. 📏', 'Menu', 'TRUE'],
  ['cuántas especialidades qué pizzas tienen', '¡Tenemos 28 especialidades! Desde pizzas clásicas como la Margarita ($160) hasta la pizza Junior\'s con 10 ingredientes ($220/$250). Escríbeme "menú" para verlas todas. 🍕', 'Menu', 'TRUE'],
  ['ingredientes qué llevan', 'Contamos con los siguientes ingredientes disponibles: Jamón, Salami, Pepperoni, Tocino, Chorizo, Salchicha Asadera, Salchicha Pavo, Frijol, Philadelphia, Atún, Champiñón, Piña, Pimiento, Cebolla, Jalapeño, Tomate, Aceitunas y Mantequilla de Ajo. 🧀', 'Menu', 'TRUE'],
  ['extra ingrediente adicional', 'Puedes agregar ingrediente extra por +$30 y queso extra por +$50. 🧀', 'Extras', 'TRUE'],
  ['orilla Philadelphia', 'Sí, ofrecemos orilla rellena de queso Philadelphia en cualquier pizza por solo +$50. ¡Está deliciosa! 🧀', 'Extras', 'TRUE'],
  ['vegana vegetariana sin carne', '¡Sí! Tenemos la pizza Vegetariana: queso, champiñón, cebolla, tomate y pimiento. Mediana $195 / Grande $220. 🌿', 'Especial', 'TRUE'],
  ['sin gluten celíaco', 'Por el momento no contamos con masa sin gluten. Si tienes otra restricción alimentaria, con gusto te ayudamos. 🙏', 'Especial', 'TRUE'],
  ['promo promoción descuento oferta', '¡Tenemos 3 promos! 🎉\n• Promo #1: 2 pizzas grandes (Pepperoni + Hawaiana) por $290\n• Promo #2: Pizza grande 3 ingredientes + pan de ajo + Coca 1.35L por $230\n• Promo #3: Pizza grande 1 ingrediente + pan de ajo + Coca 1.35L por $205\n¡No se aceptan cambios en las promos!', 'Promociones', 'TRUE'],
  ['promo 1', 'La Promo #1 incluye: 1 pizza grande de Pepperoni + 1 pizza grande de Hawaiana por $290. ¡No se aceptan cambios! 🍕🍕', 'Promociones', 'TRUE'],
  ['promo 2', 'La Promo #2 incluye: pizza grande con 3 ingredientes a elegir + pan de ajo + Coca-Cola 1.35L por solo $230. ¡No se aceptan cambios! 🍕🥖🥤', 'Promociones', 'TRUE'],
  ['promo 3', 'La Promo #3 incluye: pizza grande con 1 ingrediente + pan de ajo + Coca-Cola 1.35L por $205. ¡No se aceptan cambios! 🍕🥖🥤', 'Promociones', 'TRUE'],
  ['pan de ajo', 'Sí, tenemos pan de ajo por $40. También viene incluido en las Promos #2 y #3. 🥖', 'Menu', 'TRUE'],
  ['bebida refresco coca', 'La Coca-Cola 1.35L viene incluida en las Promos #2 y #3. 🥤', 'Bebidas', 'TRUE'],
  ['cancelar pedido', 'Para cancelar un pedido, contáctanos lo antes posible al mismo número de WhatsApp. Si ya está en preparación puede no ser posible cancelarlo. 🙏', 'Pedidos', 'TRUE'],
  ['queja problema', 'Lamentamos mucho el inconveniente. Voy a conectarte con nuestro equipo ahora mismo para resolver tu situación. 🙏', 'Soporte', 'TRUE'],
  ['factura facturación RFC comprobante fiscal', 'Por el momento no manejamos facturación. Solo emitimos ticket de compra. Disculpa los inconvenientes. 🙏', 'Pagos', 'TRUE'],
  ['cambio repartidor lleva cambio efectivo', '¡Sí! Nuestro repartidor siempre lleva cambio. Puedes pagar con cualquier billete sin problema. 💵', 'Pagos', 'TRUE'],
  ['hawaiana ingredientes precio', 'La pizza Hawaiana lleva queso, jamón y piña. Mediana $180 / Grande $210. 🍕', 'Precios', 'TRUE'],
  ['pepperoni ingredientes precio', 'La pizza Pepperoni lleva queso y pepperoni. Mediana $160 / Grande $180. 🍕', 'Precios', 'TRUE'],
  ['4 quesos cuatro quesos ingredientes precio', 'La pizza 4 Quesos lleva queso manchego, mozzarella, philadelphia y cheddar. Mediana $230 / Grande $250. 🧀', 'Precios', 'TRUE'],
  ['suprema ingredientes precio', 'La pizza Suprema lleva queso, salami, pepperoni, chorizo, aceitunas, pimiento y cebolla. Mediana $215 / Grande $235. 🍕', 'Precios', 'TRUE'],
  ['junior ingredientes precio', 'La pizza Junior\'s lleva queso, jamón, salami, pepperoni, tocino, chorizo, champiñón, cebolla, pimiento y mantequilla de ajo. Mediana $220 / Grande $250. 🍕👑', 'Precios', 'TRUE'],
]

// ─── MENÚ ─────────────────────────────────────────────────────────────────────
const menu = [
  ['Categoría', 'Producto', 'Descripción', 'Precio', 'Disponible'],

  // Especialidades Grupo 1
  ['🍕 Especialidades', 'Ajo Mediana', 'Queso, mantequilla de ajo', '160', 'TRUE'],
  ['🍕 Especialidades', 'Ajo Grande', 'Queso, mantequilla de ajo', '180', 'TRUE'],
  ['🍕 Especialidades', 'Margarita Mediana', 'Queso', '160', 'TRUE'],
  ['🍕 Especialidades', 'Margarita Grande', 'Queso', '180', 'TRUE'],
  ['🍕 Especialidades', 'Pepperoni Mediana', 'Queso, pepperoni', '160', 'TRUE'],
  ['🍕 Especialidades', 'Pepperoni Grande', 'Queso, pepperoni', '180', 'TRUE'],
  ['🍕 Especialidades', 'Champiñón Mediana', 'Queso, champiñón', '160', 'TRUE'],
  ['🍕 Especialidades', 'Champiñón Grande', 'Queso, champiñón', '180', 'TRUE'],
  ['🍕 Especialidades', 'Hawaiana Mediana', 'Queso, jamón, piña', '180', 'TRUE'],
  ['🍕 Especialidades', 'Hawaiana Grande', 'Queso, jamón, piña', '210', 'TRUE'],
  ['🍕 Especialidades', 'Pecham Mediana', 'Queso, pepperoni, champiñón', '180', 'TRUE'],
  ['🍕 Especialidades', 'Pecham Grande', 'Queso, pepperoni, champiñón', '210', 'TRUE'],
  ['🍕 Especialidades', 'Jasa Mediana', 'Queso, jamón, salami', '180', 'TRUE'],
  ['🍕 Especialidades', 'Jasa Grande', 'Queso, jamón, salami', '210', 'TRUE'],
  ['🍕 Especialidades', 'Sacha Mediana', 'Queso, salami, champiñón', '180', 'TRUE'],
  ['🍕 Especialidades', 'Sacha Grande', 'Queso, salami, champiñón', '210', 'TRUE'],
  ['🍕 Especialidades', 'Jacha Mediana', 'Queso, jamón, champiñón', '180', 'TRUE'],
  ['🍕 Especialidades', 'Jacha Grande', 'Queso, jamón, champiñón', '210', 'TRUE'],
  ['🍕 Especialidades', 'Picosita Mediana', 'Queso, chorizo, jalapeño', '180', 'TRUE'],
  ['🍕 Especialidades', 'Picosita Grande', 'Queso, chorizo, jalapeño', '210', 'TRUE'],

  // Especialidades Grupo 2
  ['🍕 Especialidades', 'Salchipotle Mediana', 'Queso, salsa de chipotle asadera, cebolla', '185', 'TRUE'],
  ['🍕 Especialidades', 'Salchipotle Grande', 'Queso, salsa de chipotle asadera, cebolla', '215', 'TRUE'],
  ['🍕 Especialidades', 'Americana Mediana', 'Queso, jamón, salami, champiñón', '185', 'TRUE'],
  ['🍕 Especialidades', 'Americana Grande', 'Queso, jamón, salami, champiñón', '215', 'TRUE'],
  ['🍕 Especialidades', 'Carnes Frías Mediana', 'Queso, jamón, salami, pepperoni, chorizo', '195', 'TRUE'],
  ['🍕 Especialidades', 'Carnes Frías Grande', 'Queso, jamón, salami, pepperoni, chorizo', '220', 'TRUE'],
  ['🍕 Especialidades', 'Mexicana Mediana', 'Queso, salami, chorizo, cebolla, jalapeño', '195', 'TRUE'],
  ['🍕 Especialidades', 'Mexicana Grande', 'Queso, salami, chorizo, cebolla, jalapeño', '220', 'TRUE'],
  ['🍕 Especialidades', 'Vegetariana Mediana', 'Queso, champiñón, cebolla, tomate, pimiento', '195', 'TRUE'],
  ['🍕 Especialidades', 'Vegetariana Grande', 'Queso, champiñón, cebolla, tomate, pimiento', '220', 'TRUE'],
  ['🍕 Especialidades', 'Honolulu Mediana', 'Queso, jamón, piña, tocino, jalapeño', '195', 'TRUE'],
  ['🍕 Especialidades', 'Honolulu Grande', 'Queso, jamón, piña, tocino, jalapeño', '220', 'TRUE'],
  ['🍕 Especialidades', 'Extravagante Mediana', 'Queso, jamón, piña, chorizo, champiñón', '195', 'TRUE'],
  ['🍕 Especialidades', 'Extravagante Grande', 'Queso, jamón, piña, chorizo, champiñón', '220', 'TRUE'],

  // Especialidades Grupo 3
  ['🍕 Especialidades', 'Volcánica Mediana', 'Queso, pepperoni, chorizo, cebolla, jalapeño', '195', 'TRUE'],
  ['🍕 Especialidades', 'Volcánica Grande', 'Queso, pepperoni, chorizo, cebolla, jalapeño', '220', 'TRUE'],
  ['🍕 Especialidades', 'Atún Mediana', 'Queso, atún, tomate, cebolla, jalapeño', '195', 'TRUE'],
  ['🍕 Especialidades', 'Atún Grande', 'Queso, atún, tomate, cebolla, jalapeño', '220', 'TRUE'],
  ['🍕 Especialidades', 'Italiana Mediana', 'Queso, salchicha pavo, cebolla, pimiento, tocino, mantequilla de ajo', '205', 'TRUE'],
  ['🍕 Especialidades', 'Italiana Grande', 'Queso, salchicha pavo, cebolla, pimiento, tocino, mantequilla de ajo', '225', 'TRUE'],
  ['🍕 Especialidades', 'Ranchera Mediana', 'Queso, salami, frijol, chorizo, cebolla, jalapeño', '205', 'TRUE'],
  ['🍕 Especialidades', 'Ranchera Grande', 'Queso, salami, frijol, chorizo, cebolla, jalapeño', '225', 'TRUE'],
  ['🍕 Especialidades', 'Norteña Mediana', 'Queso, salchicha asadera, frijol, cebolla, jalapeño, mantequilla de ajo', '205', 'TRUE'],
  ['🍕 Especialidades', 'Norteña Grande', 'Queso, salchicha asadera, frijol, cebolla, jalapeño, mantequilla de ajo', '225', 'TRUE'],
  ['🍕 Especialidades', 'Suprema Mediana', 'Queso, salami, pepperoni, chorizo, aceitunas, pimiento, cebolla', '215', 'TRUE'],
  ['🍕 Especialidades', 'Suprema Grande', 'Queso, salami, pepperoni, chorizo, aceitunas, pimiento, cebolla', '235', 'TRUE'],

  // Especialidades Grupo 4
  ['🍕 Especialidades', 'Campestre Mediana', 'Queso, pepperoni, jamón, champiñón, tocino, pimiento, cebolla', '215', 'TRUE'],
  ['🍕 Especialidades', 'Campestre Grande', 'Queso, pepperoni, jamón, champiñón, tocino, pimiento, cebolla', '235', 'TRUE'],
  ['🍕 Especialidades', 'Carnes Frías Especial Mediana', 'Queso, jamón, salami, pepperoni, chorizo, tocino, pavo, asadera', '225', 'TRUE'],
  ['🍕 Especialidades', 'Carnes Frías Especial Grande', 'Queso, jamón, salami, pepperoni, chorizo, tocino, pavo, asadera', '245', 'TRUE'],
  ['🍕 Especialidades', 'Pastor Mediana', 'Queso, pastor, piña, cebolla, cilantro', '225', 'TRUE'],
  ['🍕 Especialidades', 'Pastor Grande', 'Queso, pastor, piña, cebolla, cilantro', '245', 'TRUE'],
  ['🍕 Especialidades', '4 Quesos Mediana', 'Queso manchego, mozzarella, philadelphia, cheddar', '230', 'TRUE'],
  ['🍕 Especialidades', '4 Quesos Grande', 'Queso manchego, mozzarella, philadelphia, cheddar', '250', 'TRUE'],
  ['🍕 Especialidades', 'Junior\'s Mediana', 'Queso, jamón, salami, pepperoni, tocino, chorizo, champiñón, cebolla, pimiento, mantequilla de ajo', '220', 'TRUE'],
  ['🍕 Especialidades', 'Junior\'s Grande', 'Queso, jamón, salami, pepperoni, tocino, chorizo, champiñón, cebolla, pimiento, mantequilla de ajo', '250', 'TRUE'],

  // Extras
  ['➕ Extras', 'Ingrediente extra', 'Agrega un ingrediente adicional a cualquier pizza', '30', 'TRUE'],
  ['➕ Extras', 'Queso extra', 'Porción extra de queso mozzarella', '50', 'TRUE'],
  ['➕ Extras', 'Orilla Philadelphia', 'Orilla rellena de queso Philadelphia', '50', 'TRUE'],
  ['➕ Extras', 'Pan de ajo', 'Pan horneado con mantequilla de ajo', '40', 'TRUE'],

  // Promociones
  ['🎉 Promociones', 'Promo #1', '1 pizza grande Pepperoni + 1 pizza grande Hawaiana. ¡No se aceptan cambios!', '290', 'TRUE'],
  ['🎉 Promociones', 'Promo #2', 'Pizza grande 3 ingredientes + pan de ajo + Coca-Cola 1.35L. ¡No se aceptan cambios!', '230', 'TRUE'],
  ['🎉 Promociones', 'Promo #3', 'Pizza grande 1 ingrediente + pan de ajo + Coca-Cola 1.35L. ¡No se aceptan cambios!', '205', 'TRUE'],
]

async function clearAndWrite(sheetTitle, values) {
  // Check if sheet exists, create if not
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const existing = meta.data.sheets.find(s => s.properties.title === sheetTitle)

  if (!existing) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetTitle } } }]
        }
      })
      console.log(`✅ Pestaña "${sheetTitle}" creada`)
    } catch {
      // Tab already exists with slightly different casing — continue
    }
  }

  // Clear existing content
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetTitle}!A1:Z1000`,
  })

  // Write new content
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetTitle}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values },
  })

  console.log(`✅ ${sheetTitle}: ${values.length - 1} filas escritas`)
}

async function main() {
  console.log('🍕 Llenando Google Sheet de Pizza Juniors Cozumel...\n')
  await clearAndWrite('Conocimiento', conocimiento)
  await clearAndWrite('Menu', menu)
  console.log('\n🎉 ¡Sheet listo! El bot ya puede leer el menú y la base de conocimiento.')
}

main().catch(console.error)
