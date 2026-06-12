import { getDb } from '@/lib/db'
import { KnowledgeManager } from './knowledge-manager'

function getSpreadsheetId(): string | undefined {
  const db = getDb()
  const row = db.prepare("SELECT value FROM settings WHERE key = 'google_spreadsheet_id'").get() as { value: string } | undefined
  return row?.value || process.env.GOOGLE_SHEETS_SPREADSHEET_ID || undefined
}

export default function KnowledgePage() {
  const spreadsheetId = getSpreadsheetId()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Base de conocimiento</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Las entradas se sincronizan desde Google Sheets cada 5 minutos o al presionar &quot;Sincronizar&quot;.
          Para editar, abre el Sheet directamente.
        </p>
      </div>
      <KnowledgeManager spreadsheetId={spreadsheetId} />
    </div>
  )
}
