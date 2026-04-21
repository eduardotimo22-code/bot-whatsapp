'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  MessageSquare,
  Users,
  Calendar,
  Settings,
  Bot,
  LayoutDashboard,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/conversations', label: 'Conversaciones', icon: MessageSquare },
  { href: '/contacts', label: 'Contactos', icon: Users },
  { href: '/scheduler', label: 'Programados', icon: Calendar },
  { href: '/settings', label: 'Configuración', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 border-r bg-background flex flex-col h-screen sticky top-0">
      <div className="flex items-center gap-2 px-5 py-5 border-b">
        <Bot className="h-6 w-6 text-primary" />
        <span className="font-semibold text-base">WhatsApp Bot</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-5 py-4 border-t">
        <p className="text-xs text-muted-foreground">Sistema local · Sin login</p>
      </div>
    </aside>
  )
}
