export type ConversationStatus = 'active' | 'escalated' | 'resolved'
export type MessageRole = 'user' | 'assistant' | 'human'
export type JobStatus = 'pending' | 'sent' | 'failed'
export type TargetType = 'contact' | 'group' | 'broadcast'

export interface Conversation {
  id: string
  contact_name: string | null
  phone: string
  status: ConversationStatus
  last_message_at: string | null
  is_group: number
  created_at: string
  // computed fields from JOINs
  last_message?: string
  unread_count?: number
}

export interface Message {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  ycloud_message_id: string | null
  created_at: string
}

export interface Contact {
  id: string
  phone: string
  name: string | null
  email: string | null
  interest: string | null
  notion_page_id: string | null
  source: string
  created_at: string
}

export interface ScheduledJob {
  id: string
  target_type: TargetType
  target_id: string
  target_name: string | null
  message: string
  scheduled_at: string
  status: JobStatus
  trigger_job_id: string | null
  created_at: string
}

export interface Setting {
  key: string
  value: string
  updated_at: string
}

export interface BotSettings {
  bot_name: string
  tone: string
  system_prompt: string
  business_hours_start: string
  business_hours_end: string
  business_days: string // JSON array: ["Mon","Tue","Wed","Thu","Fri"]
  escalation_keywords: string // JSON array
  escalation_after_turns: string
  notion_kb_db_id: string
  notion_conversations_db_id: string
  notion_leads_db_id: string
  notion_scheduled_db_id: string
  owner_phone: string // número del dueño para notificaciones de escalado
  appointment_notification_phone: string // número que recibe notificaciones de citas confirmadas
}

// YCloud webhook event (v2 format)
export interface YCloudEvent {
  id: string
  type: string
  apiVersion: string
  createTime: string
  whatsappInboundMessage?: YCloudInboundMessage
}

export interface YCloudInboundMessage {
  id: string
  wamid: string
  wabaId: string
  from: string
  customerProfile?: { name: string }
  to: string
  sendTime: string
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'reaction'
  text?: { body: string }
}

export interface YCloudStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
}

// Dashboard stats
export interface DashboardStats {
  active_conversations: number
  escalated_conversations: number
  total_contacts: number
  pending_jobs: number
  messages_today: number
}
