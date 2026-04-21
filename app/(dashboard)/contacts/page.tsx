import { getDb } from '@/lib/db'
import type { Contact } from '@/types'
import { ContactsList } from './contacts-list'

type ContactWithConv = Contact & {
  conv_status: 'active' | 'escalated' | 'resolved' | null
  conv_id: string | null
}

export default function ContactsPage() {
  const db = getDb()
  const contacts = db.prepare(`
    SELECT ct.*,
      cv.status as conv_status,
      cv.id     as conv_id
    FROM contacts ct
    LEFT JOIN conversations cv ON cv.phone = ct.phone
    ORDER BY ct.created_at DESC
  `).all() as ContactWithConv[]

  return <ContactsList contacts={contacts} />
}
