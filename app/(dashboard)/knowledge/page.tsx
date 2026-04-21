import { KnowledgeManager } from './knowledge-manager'

export default function KnowledgePage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Base de conocimiento</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Las entradas se sincronizan con Notion cada 5 minutos o al guardar.
        </p>
      </div>
      <KnowledgeManager />
    </div>
  )
}
