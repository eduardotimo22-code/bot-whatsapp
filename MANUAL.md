# Manual de Uso — Bot WhatsApp ESCALA

## Índice
1. [¿Qué es este sistema?](#1-qué-es-este-sistema)
2. [Acceso al dashboard](#2-acceso-al-dashboard)
3. [Dashboard principal](#3-dashboard-principal)
4. [Conversaciones](#4-conversaciones)
5. [Contactos y Leads](#5-contactos-y-leads)
6. [Base de conocimiento](#6-base-de-conocimiento)
7. [Mensajes programados](#7-mensajes-programados)
8. [Configuración](#8-configuración)
9. [Integración con Notion](#9-integración-con-notion)
10. [Escalado al humano](#10-escalado-al-humano)
11. [Preguntas frecuentes](#11-preguntas-frecuentes)

---

## 1. ¿Qué es este sistema?

Es un bot de WhatsApp con inteligencia artificial conectado a un panel de control web. El bot responde automáticamente a los mensajes de tus clientes usando GPT-4o y una base de conocimiento personalizada. Cuando el bot no puede resolver algo, escala la conversación al equipo humano.

**Componentes principales:**
- **Bot de WhatsApp** — responde mensajes automáticamente 24/7
- **Dashboard web** — panel de control para gestionar todo
- **Notion** — base de conocimiento, leads y conversaciones sincronizados
- **Railway** — servidor en la nube donde corre todo

---

## 2. Acceso al dashboard

**URL de producción (Railway):**
```
https://bot-whatsapp-production-7ddf.up.railway.app
```

**Para crear un acceso directo en el escritorio (Chrome/Edge):**
1. Abre la URL en el navegador
2. Menú (⋮) → Guardar e compartir → Crear acceso directo
3. Activa "Abrir como ventana" → Crear

**Uso local (si tienes el proyecto en tu máquina):**
```
http://localhost:3131
```

---

## 3. Dashboard principal

La pantalla de inicio muestra las estadísticas del bot en tiempo real:

| Métrica | Descripción |
|---|---|
| Conversaciones activas | Chats donde el bot está respondiendo |
| Conversaciones escaladas | Chats que esperan atención humana |
| Total de contactos | Leads registrados |
| Mensajes hoy | Volumen del día |
| Jobs pendientes | Mensajes programados por enviar |

Las estadísticas se actualizan automáticamente cada 10 segundos.

---

## 4. Conversaciones

**Ruta:** `/conversations`

Lista todas las conversaciones de WhatsApp. Desde aquí puedes:

### Filtros disponibles
- **Todas** — muestra todas las conversaciones
- **Activas** — el bot está respondiendo
- **Escaladas** — esperan atención humana (aparecen en rojo)
- **Resueltas** — conversaciones cerradas

### Vista individual de conversación
Al hacer clic en una conversación puedes:

- **Ver el historial completo** de mensajes
- **Enviar un mensaje como equipo humano** — el cliente lo recibe por WhatsApp etiquetado como "Equipo humano"
- **Cambiar el estado:**
  - `Escalar a humano` — pausa el bot y notifica al dueño
  - `Tomar control (reactivar bot)` — el bot vuelve a responder desde 0 turnos
  - `Marcar resuelta` — cierra la conversación
  - `Reabrir conversación` — vuelve a activar una resuelta

> **Importante:** Siempre usa el botón "Tomar control (reactivar bot)" desde el dashboard de Railway para reactivar una conversación escalada. Si lo haces desde el dashboard local, no afectará al bot en producción.

---

## 5. Contactos y Leads

**Ruta:** `/contacts`

Todos los contactos detectados por el bot. Un contacto se registra automáticamente cuando alguien escribe por primera vez.

### Qué puedes hacer
- **Buscar** por nombre, teléfono, email o interés
- **Editar** nombre, email e interés con el ícono de lápiz ✏️
- **Eliminar** contacto con el ícono de bote 🗑️
- **Enviar a Notion** — sube el contacto como lead a tu base de datos de Notion con un clic
- **Ver la conversación** asociada con el ícono de mensaje 💬

### Detección automática de leads
El bot detecta automáticamente cuando un cliente:
- Comparte su email
- Menciona palabras como "precio", "cotización", "contratar", "interesado"

Cuando detecta estas señales, guarda al contacto en Notion automáticamente.

---

## 6. Base de conocimiento

**Ruta:** `/knowledge`

Aquí defines qué sabe el bot sobre tu negocio. Cada entrada tiene:
- **Pregunta** — lo que el cliente puede preguntar
- **Respuesta** — lo que el bot debe responder
- **Categoría** — para organizarlas (Servicios, Precios, Proceso, etc.)

### Cómo funciona
El bot consulta la base de conocimiento en cada mensaje. Busca entradas cuyas palabras clave coincidan con lo que el cliente escribió y añade esa información al contexto de GPT-4o.

### Sincronización con Notion
- Las entradas se sincronizan automáticamente con tu base de datos de Notion
- El bot usa un caché local (SQLite) que se actualiza cada **5 minutos**
- Puedes forzar una sincronización inmediata con el botón **"Sincronizar con Notion"**

### Crear una entrada
1. Clic en **"Nueva entrada"**
2. Escribe la pregunta, respuesta y categoría
3. Clic en **"Guardar"** — se guarda en Notion al instante

### Editar o eliminar
Usa los íconos ✏️ y 🗑️ en cada entrada. Los cambios se aplican en Notion inmediatamente.

---

## 7. Mensajes programados

**Ruta:** `/scheduler`

Envía mensajes de WhatsApp en una fecha y hora específica.

### Tipos de destinatario
| Tipo | Descripción |
|---|---|
| Contacto | Un número específico de tu lista de contactos |
| Grupo | Un grupo de WhatsApp donde el número es administrador |
| Broadcast | Todos los contactos registrados |

### Crear un mensaje programado
1. Selecciona el tipo de destinatario
2. Elige el contacto o grupo
3. Escribe el mensaje
4. Selecciona fecha y hora
5. Clic en **"Programar"**

### Ejecutar manualmente
El botón **"Ejecutar ahora"** procesa todos los mensajes pendientes cuya hora ya pasó.

### Vista en Notion
Los mensajes programados se sincronizan automáticamente a tu base de datos de Notion con su estado:
- 🟡 **Pendiente** — aún no se ha enviado
- 🟢 **Enviado** — entregado con éxito
- 🔴 **Fallido** — hubo un error al enviar
- ⚫ **Cancelado** — fue eliminado antes de enviarse

---

## 8. Configuración

**Ruta:** `/settings`

### Bot
| Campo | Descripción |
|---|---|
| Nombre del bot | Cómo se identifica el asistente |
| Tono | Estilo de comunicación (ej. "profesional y amable") |
| System prompt | Instrucciones base del comportamiento del bot |

### Horario de atención
Define en qué días y horarios el bot responde automáticamente. Fuera de este horario, las conversaciones se escalan al humano.

### Escalado
| Campo | Descripción |
|---|---|
| Teléfono del dueño | Recibe notificaciones de WhatsApp cuando hay un escalado |
| Turnos antes de escalar | Número de mensajes del cliente antes de escalar (default: 50) |
| Keywords de escalado | Palabras que fuerzan el escalado inmediato (ej. "urgente", "queja") |

### Notificaciones de citas
- **Teléfono de notificaciones** — recibe un WhatsApp cuando el bot confirma una cita

### Notion (IDs de bases de datos)
| Campo | Qué base de datos conectar |
|---|---|
| Base de conocimiento | Preguntas y respuestas del bot |
| Conversaciones | Log de conversaciones escaladas |
| Leads | Contactos detectados como leads |
| Mensajes programados | Vista de mensajes programados |

Para obtener el ID de una base de datos en Notion: abre la base de datos → copia la URL → el ID es la cadena de 32 caracteres después del último `/`.

---

## 9. Integración con Notion

### Bases de datos requeridas

**Base de Conocimiento**
| Propiedad | Tipo |
|---|---|
| Pregunta | Title |
| Respuesta | Text |
| Categoría | Select |
| Activo | Checkbox |

**Conversaciones**
| Propiedad | Tipo |
|---|---|
| Contacto | Title |
| Teléfono | Text |
| Resumen | Text |
| Turnos | Number |
| Estado | Select |
| Fecha | Date |

**Leads**
| Propiedad | Tipo |
|---|---|
| Nombre | Title |
| Teléfono | Text |
| Email | Email |
| Interés | Text |
| Fuente | Select |
| Fecha | Date |

**Mensajes Programados**
| Propiedad | Tipo |
|---|---|
| Mensaje | Title |
| Destinatario | Text |
| Tipo | Select |
| Fecha programada | Date |
| Estado | Select |

---

## 10. Escalado al humano

Cuando el bot escala una conversación:

1. **El cliente recibe** un mensaje diciendo que el equipo humano lo atenderá pronto
2. **El dueño recibe** un WhatsApp con el nombre, teléfono y resumen de la conversación
3. **La conversación** aparece en rojo en el dashboard
4. **La conversación** se registra en Notion

### Causas de escalado
- El cliente escribe una keyword de escalado (ej. "urgente", "hablar con alguien")
- Se alcanza el límite de turnos configurado
- El bot detecta que no puede resolver la consulta
- Fuera del horario de atención

### Para reactivar el bot
1. Abre la conversación en el dashboard de Railway
2. Clic en **"Tomar control (reactivar bot)"**
3. El bot vuelve a responder y el contador de turnos se reinicia desde cero

---

## 11. Preguntas frecuentes

**¿Por qué el bot no responde?**
- Verifica que la conversación no esté escalada (aparecería en rojo)
- Confirma que las API keys (OpenAI, YCloud) están configuradas en Railway → Variables
- Revisa los logs en Railway → tab Logs

**¿Por qué el bot no usa la base de conocimiento?**
- Confirma que `notion_kb_db_id` está configurado en Settings
- Haz clic en "Sincronizar con Notion" en `/knowledge`
- Verifica que las entradas en Notion tienen el checkbox "Activo" marcado

**¿Cómo cambio el comportamiento del bot?**
- Edita el **System Prompt** en `/settings`
- Agrega o edita entradas en `/knowledge`

**¿El bot responde fuera de horario?**
- No, si tienes configurado el horario de atención. Fuera del horario escala automáticamente.
- Si quieres que responda 24/7, pon horario de 00:00 a 23:59.

**¿Cómo aplico cambios en producción?**
- Cualquier cambio de código se sube con `git push` y Railway lo redespliega automáticamente
- Los cambios de configuración (Settings, Knowledge) se aplican al instante sin necesidad de redeploy
