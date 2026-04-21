import { getDb } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { BotSettings } from '@/types'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { listWhatsAppGroups } from '@/lib/ycloud/groups'
import { GroupsManager } from './groups-manager'

const DAYS = [
  { key: 'Mon', label: 'Lun' },
  { key: 'Tue', label: 'Mar' },
  { key: 'Wed', label: 'Mié' },
  { key: 'Thu', label: 'Jue' },
  { key: 'Fri', label: 'Vie' },
  { key: 'Sat', label: 'Sáb' },
  { key: 'Sun', label: 'Dom' },
]

function getSettings(): BotSettings {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
  return Object.fromEntries(rows.map((r) => [r.key, r.value])) as unknown as BotSettings
}

async function saveSettings(formData: FormData) {
  'use server'
  const db = getDb()
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')

  const fields = [
    'bot_name', 'tone', 'system_prompt',
    'business_hours_start', 'business_hours_end',
    'escalation_after_turns', 'owner_phone',
    'notion_kb_db_id', 'notion_conversations_db_id', 'notion_leads_db_id',
    'appointment_notification_phone',
  ]

  for (const field of fields) {
    const val = formData.get(field)
    if (val !== null) upsert.run(field, val.toString())
  }

  // business_days — multi-value checkboxes
  const days = formData.getAll('business_days') as string[]
  upsert.run('business_days', JSON.stringify(days))

  // escalation_keywords — textarea, one keyword per line
  const raw = (formData.get('escalation_keywords_raw') ?? '').toString()
  const keywords = raw
    .split('\n')
    .map((k) => k.trim())
    .filter(Boolean)
  upsert.run('escalation_keywords', JSON.stringify(keywords))

  revalidatePath('/settings')
  redirect('/settings')
}

export default function SettingsPage() {
  const settings = getSettings()
  const groups = listWhatsAppGroups()

  const activeDays: string[] = (() => {
    try { return JSON.parse(settings.business_days ?? '[]') } catch { return [] }
  })()

  const keywords: string[] = (() => {
    try { return JSON.parse(settings.escalation_keywords ?? '[]') } catch { return [] }
  })()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuración del Bot</h1>
        <p className="text-muted-foreground text-sm mt-1">Personaliza el comportamiento del asistente</p>
      </div>

      <form action={saveSettings} className="space-y-6">
        {/* Personalidad */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personalidad del Bot</CardTitle>
            <CardDescription>Define cómo se comporta el asistente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bot_name">Nombre del bot</Label>
              <Input id="bot_name" name="bot_name" defaultValue={settings.bot_name} placeholder="Asistente" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tone">Tono</Label>
              <Input id="tone" name="tone" defaultValue={settings.tone} placeholder="profesional y amable" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="system_prompt">Instrucciones del sistema</Label>
              <Textarea
                id="system_prompt"
                name="system_prompt"
                defaultValue={settings.system_prompt}
                rows={5}
                placeholder="Eres un asistente de atención al cliente..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Horario */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horario de Atención</CardTitle>
            <CardDescription>Fuera de este horario el bot escala automáticamente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Días de atención</Label>
              <div className="flex gap-2 flex-wrap">
                {DAYS.map(({ key, label }) => (
                  <label
                    key={key}
                    className={`flex items-center justify-center w-12 h-10 rounded-md border text-sm font-medium cursor-pointer transition-colors select-none ${
                      activeDays.includes(key)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="business_days"
                      value={key}
                      defaultChecked={activeDays.includes(key)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">El bot solo responde automáticamente en los días seleccionados.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="business_hours_start">Hora inicio</Label>
                <Input
                  id="business_hours_start"
                  name="business_hours_start"
                  type="time"
                  defaultValue={settings.business_hours_start}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="business_hours_end">Hora fin</Label>
                <Input
                  id="business_hours_end"
                  name="business_hours_end"
                  type="time"
                  defaultValue={settings.business_hours_end}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Escalación */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Escalación al Humano</CardTitle>
            <CardDescription>Cuándo y cómo derivar al equipo humano</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="escalation_after_turns">Escalar después de N turnos sin resolución</Label>
              <Input
                id="escalation_after_turns"
                name="escalation_after_turns"
                type="number"
                min="1"
                max="20"
                defaultValue={settings.escalation_after_turns}
                className="w-24"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="escalation_keywords_raw">Palabras clave de escalación</Label>
              <Textarea
                id="escalation_keywords_raw"
                name="escalation_keywords_raw"
                defaultValue={keywords.join('\n')}
                rows={4}
                placeholder={'hablar con alguien\nhablar con una persona\nurgente\nqueja'}
              />
              <p className="text-xs text-muted-foreground">Una por línea. Si el cliente escribe alguna de estas frases, el bot escala inmediatamente.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner_phone">Teléfono del dueño (notificaciones de escalado)</Label>
              <Input
                id="owner_phone"
                name="owner_phone"
                defaultValue={settings.owner_phone}
                placeholder="521234567890"
              />
              <p className="text-xs text-muted-foreground">Código de país + número, sin espacios ni +</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appointment_notification_phone">Teléfono para notificaciones de citas</Label>
              <Input
                id="appointment_notification_phone"
                name="appointment_notification_phone"
                defaultValue={settings.appointment_notification_phone}
                placeholder="521234567890"
              />
              <p className="text-xs text-muted-foreground">Cuando el bot confirme una cita, enviará un WhatsApp a este número con el resumen.</p>
            </div>
          </CardContent>
        </Card>

        {/* Notion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Integración con Notion</CardTitle>
            <CardDescription>IDs de las bases de datos de Notion (dejar vacío si no se usa)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="notion_kb_db_id">Base de conocimiento</Label>
              <Input
                id="notion_kb_db_id"
                name="notion_kb_db_id"
                defaultValue={settings.notion_kb_db_id}
                placeholder="ID de la base de datos"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notion_conversations_db_id">Log de conversaciones</Label>
              <Input
                id="notion_conversations_db_id"
                name="notion_conversations_db_id"
                defaultValue={settings.notion_conversations_db_id}
                placeholder="ID de la base de datos"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notion_leads_db_id">Base de leads</Label>
              <Input
                id="notion_leads_db_id"
                name="notion_leads_db_id"
                defaultValue={settings.notion_leads_db_id}
                placeholder="ID de la base de datos"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Guardar cambios</Button>
        </div>
      </form>

      {/* Groups — outside the form, managed via API */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Grupos de WhatsApp</CardTitle>
          <CardDescription>Grupos donde eres administrador. Se usan en el scheduler para envíos programados.</CardDescription>
        </CardHeader>
        <CardContent>
          <GroupsManager initial={groups} />
        </CardContent>
      </Card>
    </div>
  )
}
