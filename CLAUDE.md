# Bot WhatsApp — CLAUDE.md

## Stack

- **Next.js 16** (App Router) — puerto `3131`
- **SQLite** via `better-sqlite3` (síncrono, NO async/await)
- **YCloud** — WhatsApp Business API v2
- **OpenAI** — GPT-4o para respuestas del bot
- **Notion** — base de conocimiento, log de conversaciones, leads
- **PM2** — process manager en Windows (`pm2 restart bot-whatsapp`)

## Arrancar el servidor

```bash
pm2 start ecosystem.config.js   # primera vez
pm2 restart bot-whatsapp        # para aplicar cambios
pm2 logs bot-whatsapp           # ver logs en tiempo real
pm2 status                      # estado
```

El servidor corre en `http://localhost:3131`. Para exponer el webhook usa ngrok:
```bash
./ngrok http 3131
```
La URL del webhook se configura en el panel de YCloud apuntando a `https://<ngrok-url>/api/webhook`.

## Variables de entorno

El archivo es `.env` (NO `.env.local`).

```
YCLOUD_API_KEY=...
YCLOUD_PHONE_NUMBER=+529878005982   # número sin normalizar
OPENAI_API_KEY=...
NOTION_API_KEY=...
# Los Notion DB IDs NO se leen del .env — van en /settings (SQLite)
```

## Base de datos SQLite

Ruta: `data/bot.db`

Tablas: `conversations`, `messages`, `contacts`, `scheduled_jobs`, `settings`

**Las settings se leen siempre de SQLite**, no del `.env`. Los campos importantes:
- `notion_kb_db_id`, `notion_conversations_db_id`, `notion_leads_db_id` — IDs de Notion
- `owner_phone` — recibe alertas de escalado
- `appointment_notification_phone` — recibe notificaciones de citas confirmadas
- `business_hours_start/end`, `business_days` — horario de atención
- `escalation_keywords` — JSON array de frases que fuerzan escalado
- `escalation_after_turns` — máximo de turnos antes de escalar

Para inspeccionar la DB:
```bash
node -e "const db = require('better-sqlite3')('data/bot.db'); console.log(db.prepare('SELECT key, value FROM settings').all())"
```

## Arquitectura del flujo de mensajes

```
WhatsApp → YCloud → POST /api/webhook
  → verifyYCloudSignature (lib/ycloud/webhook.ts)
  → processIncomingMessage (guarda en SQLite)
  → processMessage (lib/ai/processor.ts)
      → buildContext (historial + Notion KB + settings)
      → GPT-4o
      → detecta [CITA_CONFIRMADA:...] → notifica por WhatsApp
      → checkEscalation → si escala: notifica owner + log Notion
      → sendTextMessage → YCloud → cliente
      → detectLeadSignals → saveLeadToNotion
```

## Normalización de teléfonos

YCloud requiere números **sin `+`**. Siempre usar `normalizePhone()` antes de guardar en DB o enviar a YCloud. Los IDs de conversación son el número normalizado (sin `+`).

```ts
function normalizePhone(phone: string): string {
  return phone.startsWith('+') ? phone.slice(1) : phone
}
```

## Verificación de firma YCloud

YCloud usa Svix. El secret tiene prefijo `whsec_`. Si `YCLOUD_WEBHOOK_SECRET` no está en `.env`, la verificación se omite (útil para desarrollo). En producción debe estar activo.

## Estructura de archivos clave

```
app/
  (dashboard)/
    page.tsx                    — Dashboard con stats
    conversations/              — Lista y vista de conversaciones
    contacts/                   — Contactos/leads
    scheduler/                  — Mensajes programados
    settings/                   — Configuración del bot
  api/
    webhook/route.ts            — Recibe eventos de YCloud
    groups/route.ts             — Lista grupos de WhatsApp
    scheduler/route.ts          — CRUD de jobs programados
    scheduler/run/route.ts      — Ejecutar scheduler manualmente
    stats/route.ts              — Stats para polling del dashboard
    conversations/[id]/messages/route.ts — Polling de mensajes

lib/
  ai/
    processor.ts                — Pipeline principal: GPT + envío + leads + citas
    context-builder.ts          — Construye el system prompt con settings + Notion KB
    escalation.ts               — Lógica de escalado al humano
  ycloud/
    client.ts                   — HTTP client base
    sender.ts                   — sendTextMessage, sendGroupMessage, sendTemplateMessage
    groups.ts                   — listWhatsAppGroups
    webhook.ts                  — Verificación de firma Svix
  notion/
    client.ts                   — Cliente Notion (lee NOTION_API_KEY del env)
    knowledge.ts                — queryKnowledgeBase (busca por keywords)
    conversations.ts            — logConversationToNotion
    leads.ts                    — saveLeadToNotion, detectLeadSignals
  db/
    index.ts                    — getDb() singleton + migraciones inline
    schema.sql                  — Schema completo
  scheduler/
    jobs.ts                     — processPendingJobs()

types/index.ts                  — Tipos globales (Conversation, Message, BotSettings, etc.)
```

## Flujo de citas confirmadas

El system prompt instruye al bot para que cuando confirme una cita incluya al final de su respuesta:
```
[CITA_CONFIRMADA: nombre=X, fecha=Y, hora=Z, servicio=W]
```
El procesador extrae ese tag, lo elimina del mensaje antes de enviarlo al cliente, y manda un WhatsApp al `appointment_notification_phone` configurado en settings.

## Scheduler de mensajes programados

- Target types: `contact` (número individual), `group` (grupo WhatsApp por JID), `broadcast` (todos los contactos)
- Los grupos se obtienen de YCloud via `GET /api/groups`
- Para enviar a grupos el número debe ser administrador del grupo
- El scheduler se ejecuta manualmente con el botón en `/scheduler` o via `POST /api/scheduler/run`

## Notion — estructura de las bases de datos

**Base de Conocimiento** (`notion_kb_db_id`):
- `Pregunta` (title), `Respuesta` (rich_text), `Categoría` (select), `Activo` (checkbox)

**Conversaciones** (`notion_conversations_db_id`):
- `Contacto` (title), `Teléfono` (rich_text), `Resumen` (rich_text), `Turnos` (number), `Estado` (select), `Fecha` (date)

**Leads** (`notion_leads_db_id`):
- `Nombre` (title), `Teléfono` (rich_text), `Email` (email), `Interés` (rich_text), `Fuente` (select), `Fecha` (date)

## Convenciones

- SQLite es síncrono — no uses `async/await` con `better-sqlite3`
- Los Server Components leen DB directamente; los Client Components usan fetch a API routes
- El polling en el frontend usa `setInterval` con `useCallback` (no SWR)
- `nanoid()` para todos los IDs
