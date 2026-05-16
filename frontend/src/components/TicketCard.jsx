import { Link } from 'react-router-dom'
import AlertBadge from './AlertBadge'
import StatusIndicator from './StatusIndicator'
import { formatDistanceToNow } from 'date-fns'
import { Bot, User } from 'lucide-react'

export default function TicketCard({ ticket: t }) {
  return (
    <Link to={`/tickets/${t.id}`} className="block group">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-3.5 border-b border-zoho-border hover:bg-zoho-body transition-colors">
        <span className="text-xs font-mono text-zoho-muted w-20 truncate">{t.ticket_number}</span>

        <div className="min-w-0">
          <p className="text-sm font-medium text-zoho-text group-hover:text-brand-500 transition-colors truncate">{t.title}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-zoho-muted">
            <span className="capitalize">{t.category}</span>
            {t.assigned_technician && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {t.assigned_technician.full_name}
              </span>
            )}
            {t.ai_diagnosis && !t.ai_diagnosis.error && (
              <span className="flex items-center gap-1 text-violet-600">
                <Bot className="w-3 h-3" /> AI
              </span>
            )}
          </div>
        </div>

        <StatusIndicator status={t.status} />
        <AlertBadge priority={t.priority} />
        <span className="text-xs text-zoho-muted whitespace-nowrap">
          {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
        </span>
      </div>
    </Link>
  )
}
