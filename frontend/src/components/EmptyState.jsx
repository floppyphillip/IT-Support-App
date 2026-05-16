export default function EmptyState({ icon: Icon, title, description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#1e2840' }}>
        <Icon className="w-8 h-8 text-slate-500" />
      </div>
      <h3 className="text-base font-semibold text-slate-200 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-5 max-w-xs">{description}</p>}
      {action && (
        <button onClick={action} className="btn-primary">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
