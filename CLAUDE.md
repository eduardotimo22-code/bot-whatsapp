# Bot WhatsApp Pizza Juniors Cozumel — CLAUDE.md

## Arquitectura: dos aplicaciones

1. **`worker/` — PRODUCCIÓN.** Cloudflare Worker desplegado en
   `https://pizza-juniors-bot.eduardo-timo22.workers.dev`. Es el bot real:
   recibe el webhook de YCloud, responde con GPT-4o-mini, toma pedidos y
   notifica a los dueños. Base de datos **D1** (`pizza-juniors-bot`), fotos del
   menú en **KV** (`MENU_IMAGES`, servidas en `/menu/<archivo>.jpg`).
2. **Raíz — Next.js 16** (puerto `3131`). Dashboard de administración + versión
   local del bot. Usa **SQLite** (`data/bot.db`, `better-sqlite3` síncrono — NO
   async/await). OJO: el dashboard lee SQLite local, NO la D1 de producción.

Hay lógica duplicada entre `lib/` (Next) y `worker/src/`. **La fuente de verdad
del comportamiento del bot es `worker/src/`** — cualquier fix de bot va ahí
primero.

## Comandos del worker (desde `worker/`)

```bash
npm run type-check        # tsc --noEmit
npm run deploy            # wrangler deploy a producción
npx wrangler tail         # logs de producción en vivo
npm run db:migrate        # aplicar schema.sql a D1 remota
npx wrangler d1 execute pizza-juniors-bot --command "SELECT ..."   # consultar D1
npx wrangler secret put NOMBRE   # setear secrets de producción
```

Secrets del worker (via `wrangler secret put`; en local van en `worker/.dev.vars`):
`OPENAI_API_KEY`, `YCLOUD_API_KEY`, `YCLOUD_PHONE_NUMBER`,
`GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`,
`GOOGLE_SHEETS_SPREADSHEET_ID`, `YCLOUD_WEBHOOK_SECRET` (opcional),
`ORDERS_API_KEY` (opcional, protege `/sync-kb`).

## App Next.js local

```bash
npm run dev               # next dev -p 3131
pm2 restart bot-whatsapp  # si corre bajo PM2
```

Variables en `.env` (NO `.env.local`): `YCLOUD_API_KEY`, `YCLOUD_PHONE_NUMBER`,
`OPENAI_API_KEY`, `GOOGLE_SHEETS_*`, `ORDERS_API_KEY`.

## Flujo de mensajes (worker)

```
WhatsApp → YCloud → POST /webhook (o /api/webhook)
  → verifyYCloudSignature (ycloud-signature o Svix)
  → getOrCreateConversation + saveUserMessage (dedupe atómico por ycloud_message_id)
  → comandos de owner: PAUSA <tel> / ACTIVAR <tel>
  → fuera de horario → mensaje de "estamos cerrados" (1 vez/día) + marca para follow-up
  → "menú" explícito → manda las fotos desde KV sin llamar a GPT
  → processMessage: buildContext (historial + kb_cache + menú Sheets) → gpt-4o-mini
      → [PEDIDO_CONFIRMADO: items=..., total=..., tipo=..., pago=...]
        → saveOrder + notifyOwners; si pago=transferencia manda imagen con datos bancarios
      → checkEscalation (keywords / turnos) → escala + notifica owners
      → sendTextMessage al cliente
```

Horario (en `worker/src/hours.ts`, hardcodeado): jueves a martes 17:00–23:40,
miércoles cerrado. Cancún es UTC-5 fijo (sin horario de verano).

## Notificaciones a owners — SIEMPRE por template

`notifyOwners()` en `worker/src/notify.ts` es el ÚNICO camino para notificar a
dueños (pedidos confirmados, reporte diario, aviso de turno). Envía el template
de WhatsApp `owner_notification` (es_MX, categoría UTILITY) — los templates se
entregan aunque la ventana de 24h del owner esté cerrada; los mensajes de texto
libres NO (fallan asíncronamente con error 131047, un try/catch no lo ve).
Fallback a texto libre solo si el template falla síncronamente (no aprobado).

- El contenido va aplanado en 1 variable de body (sin `\n`, máx ~900 chars) —
  `flattenForTemplate()`.
- Crear/consultar el template: `node scripts/create-owner-template.mjs [status]`.
- Settings: `owner_template_name` (default `owner_notification`),
  `owner_template_lang` (default `es_MX`).

## Crons del worker (UTC; Cancún = UTC-5)

- `0 * * * *` — sync de KB desde Google Sheets a `kb_cache`
- `0 22 * * *` (17:00 Cancún) — follow-up de apertura a clientes que escribieron
  fuera de horario + aviso de turno a owners (salta miércoles)
- `41 4 * * *` (23:41 Cancún) — reporte diario de ventas a owners

## Google Sheets (reemplazó a Notion)

Spreadsheet con service account JWT (scope readonly):
- Pestaña **`Conocimiento`** (`A2:D`): Pregunta | Respuesta | Categoría → tabla `kb_cache`
- Pestaña **`Menu`** (`A2:E`): Categoría | Producto | Descripción | Precio | Disponible
  → se inyecta al system prompt (caché 10 min en la app Next; sync horario en worker)

Sync manual: `POST /sync-kb` en el worker (header `x-api-key`) o
`node scripts/force-sync.mjs` para el SQLite local.

## Pedidos desde el sitio web

`POST /api/orders` (app Next.js, header `x-api-key` = `ORDERS_API_KEY`): guarda
en `orders`, confirma al cliente por WhatsApp y notifica al owner. Los mensajes
del sitio que llegan por WhatsApp con formato `💰 Total:` / `📋 Mis datos:` los
reconoce el worker (`isWebsiteOrder`) y nunca escalan.

## Settings (tabla `settings`, clave/valor)

Se leen de la DB (D1 en worker, SQLite en Next), NO del `.env`. En el worker
`getSettings()` hace merge sobre `SETTINGS_DEFAULTS` (worker/src/db.ts) — los
settings nuevos del código aparecen aunque la tabla ya esté poblada.
Claves importantes: `system_prompt`, `owner_phones` (JSON array),
`no_escalate_phones` (JSON array, nunca escalan), `escalation_keywords`,
`escalation_after_turns`, `owner_template_name`, `owner_template_lang`.

## Convenciones

- Teléfonos SIEMPRE con `normalizePhone()` (sin `+`); el ID de conversación es
  el número normalizado.
- SQLite (`better-sqlite3`) es síncrono; D1 es async.
- `nanoid()` para IDs en la app Next; `crypto.randomUUID()` en el worker.
- Server Components leen la DB directo; Client Components hacen fetch a API
  routes con polling `setInterval`.
- La memoria conversacional se resetea tras 24h sin actividad
  (`turns_reset_at`); las conversaciones escaladas se reactivan solas a las 24h.
- NO commitear: `datos bancarios de transferencia 1/`, `dev*.log`, `ngrok.exe`,
  `worker/.dev.vars` (ya en .gitignore). `worker/.dev.vars.example` debe llevar
  solo placeholders, nunca keys reales.

## Verificación de cambios del bot

```bash
cd worker && npm run type-check && npm run deploy
npx wrangler tail   # y mandar un mensaje de prueba por WhatsApp
```
