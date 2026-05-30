import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, Edit2, Trash2, X, Layers, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { fmtDateTime } from '../utils/timeFormat'

// ─── Persistence ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'netsupportai-services'

function loadServices() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

function persist(services) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(services))
}

function newId() {
  return `svc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

// ─── ServiceModal ─────────────────────────────────────────────────────────────
function ServiceModal({ service, onClose, onSave }) {
  const isEdit = !!service?.id
  const [name, setName]       = useState(service?.name ?? '')
  const [entries, setEntries] = useState(service?.entries ?? [])

  const addEntry    = () => setEntries(prev => [...prev, { name: '', value: '' }])
  const removeEntry = (i) => setEntries(prev => prev.filter((_, idx) => idx !== i))
  const setEntry    = (i, field, val) =>
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e))

  const save = () => {
    if (!name.trim()) return toast.error('Service name is required')
    onSave({
      id:         service?.id ?? newId(),
      name:       name.trim(),
      entries,
      created_at: service?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: '#fff', border: '1px solid #e5e7eb', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEdit ? 'Edit Service' : 'Create New Service'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isEdit ? 'Update service details' : 'Fill in service details below'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* Service Name */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full bg-blue-500 flex-shrink-0" />
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Service Details</h3>
            </div>
            <label className="label">Service Name *</label>
            <input
              className="input w-full"
              placeholder="e.g. Managed Firewall"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Entries */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 rounded-full bg-violet-500 flex-shrink-0" />
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Entries</h3>
                {entries.length > 0 && (
                  <span className="text-[10px] font-semibold bg-violet-50 text-violet-500 border border-violet-200 px-1.5 py-0.5 rounded-full">
                    {entries.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={addEntry}
                className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-50 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Add Entry
              </button>
            </div>

            {entries.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-8 rounded-xl text-center cursor-pointer transition-colors hover:bg-gray-50"
                style={{ border: '1.5px dashed #e5e7eb' }}
                onClick={addEntry}
              >
                <PlusCircle className="w-7 h-7 text-gray-300 mb-2" />
                <p className="text-sm font-medium text-gray-400">No entries yet</p>
                <p className="text-xs text-gray-300 mt-0.5">Click to add name / value entries</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_32px] gap-3 px-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Value</span>
                  <span />
                </div>
                {entries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-3 items-center">
                    <input
                      className="input"
                      placeholder="e.g. Price"
                      value={entry.name}
                      onChange={e => setEntry(i, 'name', e.target.value)}
                    />
                    <input
                      className="input"
                      placeholder="e.g. $99/mo"
                      value={entry.value}
                      onChange={e => setEntry(i, 'value', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeEntry(i)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEntry}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-600 transition-colors mt-1 pl-1"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add another entry
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #e5e7eb' }}>
          <button onClick={save} className="btn-primary">
            {isEdit ? 'Save Changes' : 'Create Service'}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── ServiceRow ───────────────────────────────────────────────────────────────
function ServiceRow({ service, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const entryCount = service.entries?.length ?? 0

  return (
    <>
      <tr className="border-b hover:bg-gray-50 transition-colors" style={{ borderColor: '#f3f4f6' }}>
        {/* Name */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center flex-shrink-0">
              <Layers className="w-3.5 h-3.5 text-violet-500" />
            </div>
            <span className="text-[15px] font-semibold text-gray-900">{service.name}</span>
          </div>
        </td>

        {/* Entries */}
        <td className="px-4 py-3 whitespace-nowrap">
          {entryCount > 0 ? (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-[11px] font-bold bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full hover:bg-violet-100 transition-colors"
            >
              {entryCount} entr{entryCount !== 1 ? 'ies' : 'y'}
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          ) : (
            <span className="text-[13px] text-gray-300">—</span>
          )}
        </td>

        {/* Created */}
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="text-[13px] text-gray-400">{fmtDateTime(service.created_at)}</span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(service)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
              title="Edit"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(service)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded entries */}
      {expanded && entryCount > 0 && (
        <tr style={{ borderColor: '#f3f4f6' }} className="border-b">
          <td className="p-0" />
          <td colSpan={3} className="px-4 pb-3 pt-1.5 align-top">
            <div
              className="rounded-lg overflow-hidden border border-violet-100"
              style={{ animation: 'expandDown 0.2s ease-out' }}
            >
              <div className="grid grid-cols-2 px-3 py-1.5 bg-violet-50 border-b border-violet-100">
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Name</span>
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Value</span>
              </div>
              <div className="divide-y divide-violet-50 bg-white">
                {service.entries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-2 px-3 py-1.5">
                    <span className="text-[13px] font-medium text-gray-700">{entry.name || '—'}</span>
                    <span className="text-[13px] text-gray-500">{entry.value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Services page ────────────────────────────────────────────────────────────
export default function Services() {
  const [services, setServices] = useState(loadServices)
  const [search, setSearch]     = useState('')
  const [modal, setModal]       = useState(null)

  const filtered = services.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSave = (service) => {
    setServices(prev => {
      const idx = prev.findIndex(s => s.id === service.id)
      const next = idx >= 0
        ? prev.map((s, i) => i === idx ? service : s)
        : [service, ...prev]
      persist(next)
      return next
    })
    toast.success(service.updated_at !== service.created_at ? 'Service updated' : 'Service created')
  }

  const handleDelete = (service) => {
    if (!window.confirm(`Delete service "${service.name}"? This cannot be undone.`)) return
    setServices(prev => {
      const next = prev.filter(s => s.id !== service.id)
      persist(next)
      return next
    })
    toast.success('Service deleted')
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {modal !== null && (
        <ServiceModal
          service={modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Services</h1>
          <p className="page-sub">{services.length} service{services.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({})}>
          <Plus className="w-4 h-4" /> Create New Service
        </button>
      </div>

      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          className="input pl-9 w-full"
          placeholder="Search services…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      {services.length === 0 ? (
        <div className="card p-16 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center mb-4">
            <Layers className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No services yet</p>
          <p className="text-xs text-gray-400 mb-4">Create your first service to get started.</p>
          <button className="btn-primary" onClick={() => setModal({})}>
            <Plus className="w-4 h-4" /> Create New Service
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Layers className="w-8 h-8 mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">No services match your search</p>
          <button
            onClick={() => setSearch('')}
            className="text-xs text-blue-500 hover:underline mt-2"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: 600 }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Service Name', 'Entries', 'Created', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <ServiceRow
                    key={s.id}
                    service={s}
                    onEdit={setModal}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
