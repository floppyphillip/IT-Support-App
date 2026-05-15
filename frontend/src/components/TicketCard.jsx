import { Link } from 'react-router-dom'
import AlertBadge from './AlertBadge'
import StatusIndicator from './StatusIndicator'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, User } from 'lucide-react'

export default function TicketCard({ ticket: t }) {
  return (
    <Link
      to={`/tickets/${t.id}`}
      className="card p-4 flex items-center gap-4 hover:shadow-md transition group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-gray-400">{t.ticket_number}</span>
          <AlertBadge priority={t.priority} />
          <StatusIndicator status={t.status} />
          {t.ai_diagnosis && !t.ai_diagnosis.error && (
            <span className="badge bg-purple-50 text-purple-600 text-[10px]">AI</span>
          )}
        </div>
        <p className="font-medium text-gray-900 group-hover:text-brand-600 transition truncate">{t.title}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          <span className="capitalize">{t.category}</span>
          {t.assigned_technician && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {t.assigned_technician.full_name}
            </span>
          )}
          {t.comments?.length > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> {t.comments.length}
            </span>
          )}
          <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</span>
        </div>
      </div>
    </Link>
  )
}
