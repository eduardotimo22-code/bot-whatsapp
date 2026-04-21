# Guía de Instalación Local — Bot WhatsApp ESCALA

## Requisitos del sistema

- Windows 10 / 11 (64 bits)
- Conexión a internet estable
- Mínimo 4 GB de RAM
- 2 GB de espacio libre en disco

---

## Listado de servicios y costos

Antes de instalar, necesitas tener activas las siguientes cuentas:

| Servicio | Plan recomendado | Costo mensual aproximado |
|---|---|---|
| **OpenAI** (GPT-4o) | Pay-as-you-go | $5–30 USD según volumen |
| **YCloud** (WhatsApp API) | Starter | $30–60 USD |
| **Notion** | Free o Plus | Gratis / $10 USD |
| **Railway** (servidor en la nube) | Hobby | $5 USD |
| **ngrok** (túnel local, solo si no usas Railway) | Free | Gratis |

> **Costo total estimado mensual:** $40–100 USD dependiendo del volumen de mensajes.
>
> Si usas Railway como servidor (recomendado), **no necesitas ngrok**. El bot corre 24/7 en la nube sin necesidad de tener tu computadora encendida.

---

## Paso 1 — Instalar Node.js

1. Ve a [https://nodejs.org](https://nodejs.org)
2. Descarga la versión **LTS** (la recomendada, actualmente v20 o superior)
3. Ejecuta el instalador y sigue los pasos (siguiente, siguiente, instalar)
4. Verifica la instalación: abre la terminal (tecla Windows + R → escribe `cmd` → Enter) y ejecuta:
   ```
   node --version
   ```
   Debe mostrar algo como `v20.x.x`

---

## Paso 2 — Instalar Git

1. Ve a [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Descarga e instala Git (opciones por defecto están bien)
3. Verifica:
   ```
   git --version
   ```

---

## Paso 3 — Descargar el proyecto

Abre la terminal (`cmd`) y ejecuta:

```bash
git clone https://github.com/eduardotimo22-code/bot-whatsapp.git
cd "bot-whatsapp"
```

---

## Paso 4 — Instalar dependencias

Dentro de la carpeta del proyecto, ejecuta:

```bash
npm install
```

Esto puede tardar entre 1 y 3 minutos.

---

## Paso 5 — Configurar las variables de entorno

1. En la carpeta del proyecto, crea un archivo llamado `.env` (sin extensión)
2. Ábrelo con el Bloc de notas y pega lo siguiente:

```env
YCLOUD_API_KEY=tu_api_key_de_ycloud
YCLOUD_PHONE_NUMBER=+52XXXXXXXXXX
OPENAI_API_KEY=sk-...tu_api_key_de_openai
NOTION_API_KEY=secret_...tu_api_key_de_notion
```

Reemplaza cada valor con tus credenciales reales. A continuación se explica cómo obtener cada una.

---

## Paso 6 — Obtener las API Keys

### OpenAI
1. Ve a [https://platform.openai.com](https://platform.openai.com)
2. Crea una cuenta o inicia sesión
3. Ve a **API Keys** → **Create new secret key**
4. Copia la key (empieza con `sk-`)
5. Recarga saldo en **Billing** (mínimo $5 USD para empezar)

### YCloud (WhatsApp Business API)
1. Ve a [https://app.ycloud.com](https://app.ycloud.com)
2. Crea una cuenta
3. En **Settings → API Keys**, crea una nueva key
4. En **WhatsApp → Phone Numbers**, agrega y verifica tu número de WhatsApp Business
5. En **WhatsApp → Webhooks**, configura la URL del webhook (se explica más adelante)

### Notion
1. Ve a [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Clic en **"+ New integration"**
3. Dale un nombre (ej. "Bot WhatsApp") y selecciona tu workspace
4. Copia el **Internal Integration Secret** (empieza con `secret_`)
5. En cada base de datos de Notion que uses, entra a la base de datos → **"..."** → **"Connect to"** → selecciona tu integración

---

## Paso 7 — Configurar las bases de datos en Notion

Crea 4 bases de datos en Notion con estas propiedades:

### Base de Conocimiento
| Propiedad | Tipo |
|---|---|
| Pregunta | Title |
| Respuesta | Text |
| Categoría | Select |
| Activo | Checkbox |

### Conversaciones
| Propiedad | Tipo |
|---|---|
| Contacto | Title |
| Teléfono | Text |
| Resumen | Text |
| Turnos | Number |
| Estado | Select |
| Fecha | Date |

### Leads
| Propiedad | Tipo |
|---|---|
| Nombre | Title |
| Teléfono | Text |
| Email | Email |
| Interés | Text |
| Fuente | Select |
| Fecha | Date |

### Mensajes Programados
| Propiedad | Tipo |
|---|---|
| Mensaje | Title |
| Destinatario | Text |
| Tipo | Select |
| Fecha programada | Date |
| Estado | Select |

**Para obtener el ID de cada base de datos:**
- Abre la base de datos en Notion
- Copia la URL del navegador
- El ID son los 32 caracteres al final de la URL (antes del `?v=...`)
- Ejemplo: `notion.so/MiWorkspace/`**`476b20942132464fa76e7c32d8ca0251`**`?v=...`

---

## Paso 8 — Arrancar el servidor

### Opción A: Modo desarrollo (para probar)
```bash
npm run dev
```
El dashboard estará disponible en `http://localhost:3131`

### Opción B: Con PM2 (para uso continuo en tu PC)

1. Instala PM2:
   ```bash
   npm install -g pm2
   ```
2. Inicia el bot:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```
   Ejecuta el comando que PM2 te indique para que arranque al iniciar Windows.

3. Comandos útiles de PM2:
   ```bash
   pm2 status              # ver estado
   pm2 logs bot-whatsapp   # ver logs en tiempo real
   pm2 restart bot-whatsapp # aplicar cambios
   pm2 stop bot-whatsapp   # detener
   ```

---

## Paso 9 — Configurar el webhook con ngrok

Para que YCloud pueda enviar mensajes al bot en tu PC, necesitas exponer el puerto 3131 a internet.

1. Descarga ngrok de [https://ngrok.com/download](https://ngrok.com/download)
2. Crea una cuenta gratuita en ngrok.com y obtén tu authtoken
3. Configura el authtoken (solo la primera vez):
   ```bash
   ngrok config add-authtoken TU_TOKEN
   ```
4. Inicia el túnel:
   ```bash
   ngrok http 3131
   ```
5. Copia la URL que te da ngrok (ej. `https://abc123.ngrok-free.app`)
6. Ve al panel de YCloud → **WhatsApp → Webhooks**
7. Configura la URL como: `https://abc123.ngrok-free.app/api/webhook`

> **Importante:** La URL de ngrok cambia cada vez que lo reinicias (en el plan gratuito). Cada vez que reinicias ngrok debes actualizar la URL en YCloud.
>
> Para evitar esto, se recomienda usar **Railway** como servidor permanente (ya configurado).

---

## Paso 10 — Configurar el bot desde el dashboard

1. Abre `http://localhost:3131` en tu navegador
2. Ve a **Configuración** (/settings)
3. Completa los campos:
   - **Nombre del bot** — cómo se llama el asistente
   - **Tono** — estilo de comunicación
   - **System Prompt** — instrucciones del comportamiento
   - **Teléfono del dueño** — número que recibirá alertas de escalado
   - **IDs de Notion** — pega los IDs de cada base de datos
4. Clic en **"Guardar cambios"**

5. Ve a **Base de conocimiento** (/knowledge) y agrega las preguntas frecuentes de tu negocio

---

## Paso 11 — Probar el bot

1. Desde otro teléfono, envía un mensaje de WhatsApp al número configurado
2. El bot debe responder automáticamente
3. Si no responde, revisa los logs:
   ```bash
   pm2 logs bot-whatsapp
   ```

---

## Solución de problemas comunes

| Problema | Solución |
|---|---|
| El bot no responde | Verifica que el webhook esté configurado en YCloud y que ngrok/Railway esté activo |
| Error de API Key | Revisa que las keys en el archivo `.env` sean correctas y no tengan espacios |
| No se guardan los datos en Notion | Verifica que la integración de Notion tenga acceso a las bases de datos |
| PM2 no arranca al iniciar Windows | Ejecuta `pm2 startup` y copia y pega el comando que te indica |
| El dashboard no carga | Asegúrate de que el servidor está corriendo con `pm2 status` |

---

## Resumen de costos

### Servicios externos (pago mensual)
| Servicio | Costo estimado |
|---|---|
| OpenAI GPT-4o | $5–30 USD/mes |
| YCloud WhatsApp API | $30–60 USD/mes |
| Notion (plan gratuito) | $0 |
| Railway (servidor en la nube) | $5 USD/mes |
| **Total estimado** | **$40–95 USD/mes** |

### Conversión aproximada a pesos mexicanos
| Escenario | USD/mes | MXN/mes aprox. |
|---|---|---|
| Volumen bajo (hasta 500 mensajes) | ~$40 | ~$700 MXN |
| Volumen medio (hasta 2,000 mensajes) | ~$65 | ~$1,100 MXN |
| Volumen alto (más de 5,000 mensajes) | ~$95+ | ~$1,600+ MXN |

> Tipo de cambio referencial: 1 USD ≈ $17 MXN. Los costos de OpenAI varían según el volumen de conversaciones.
