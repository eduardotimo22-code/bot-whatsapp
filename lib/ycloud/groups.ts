import { getDb } from '@/lib/db'
import { nanoid } from 'nanoid'

export interface WhatsAppGroup {
  id: string
  name: string
  jid: string
}

export function listWhatsAppGroups(): WhatsAppGroup[] {
  const db = getDb()
  return db.prepare('SELECT id, name, jid FROM whatsapp_groups ORDER BY name ASC').all() as WhatsAppGroup[]
}

export function addWhatsAppGroup(name: string, jid: string): WhatsAppGroup {
  const db = getDb()
  const id = nanoid()
  db.prepare('INSERT INTO whatsapp_groups (id, name, jid) VALUES (?, ?, ?)').run(id, name, jid)
  return { id, name, jid }
}

export function deleteWhatsAppGroup(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM whatsapp_groups WHERE id = ?').run(id)
}
