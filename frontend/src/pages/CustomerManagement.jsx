import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { customersAPI, devicesAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import {
  Plus, Search, Edit2, Trash2, X, UserCircle2,
  Mail, Phone, MapPin, Hash, ChevronDown, ChevronUp, PlusCircle,
  Server, Check, Monitor,
} from 'lucide-react'
import { SkeletonTable } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

const DEVICE_ICONS = {
  router: '🔀', switch: '🔌', server: '🖥️', workstation: '💻',
  printer: '🖨️', access_point: '📡', firewall: '🛡️', nas: '💾', camera: '📷', other: '📦',
}

const EMPTY_FIELD = { name: '', title: '' }
const EMPTY_FORM = {
  customer_name: '', customer_id: '', email: '',
  phone: '', address: '', state: '', country: '',
  custom_fields: [],
}

function DevicePickerModal({ onClose, onAdd, alreadySelectedIds }) {
  const [allDevices, setAllDevices] = useState([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState(new Set())

  useEffect(() => {
    devicesAPI.list({ category: 'customer', limit: 200 })
      .then(({ data }) => setAllDevices(data.items ?? data ?? []))
      .catch(() => setAllDevices([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = allDevices.filter(d =>
    !alreadySelectedIds.has(d.id) &&
    (d.name?.toLowerCase().includes(search.toLowerCase()) ||
     d.ip_address?.toLowerCase().includes(search.toLowerCase()))
  )

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const confirm = () => {
    onAdd(allDevices.filter(d => selected.has(d.id)))
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ background: '#fff', border: '1px solid #e5e7eb', maxHeight: '70vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Add Customer Device</h3>
            <p className="text-xs text-gray-400 mt-0.5">Select one or more devices to attach</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #f3f4f6' }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="input pl-9 w-full text-sm"
              placeholder="Search by name or IP…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Device list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-400">Loading devices…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Server className="w-8 h-8 mx-auto mb-2 text-gray-200" />
              <p className="text-sm text-gray-400">{search ? 'No matching devices' : 'No available devices'}</p>
              {!search && <p className="text-xs text-gray-300 mt-1">Add devices in Customer Devices under Tools</p>}
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {filtered.map(d => (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${selected.has(d.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  onClick={() => toggle(d.id)}
                >
                  {/* Checkbox */}
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors ${selected.has(d.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                    {selected.has(d.id) && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: '#f3f4f6' }}>
                    {DEVICE_ICONS[d.device_type] ?? '📦'}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{d.name}</p>
                    <p className="text-xs font-mono text-gray-400 truncate">{d.ip_address}</p>
                  </div>
                  {/* Status pill */}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize flex-shrink-0 ${
                    d.status === 'online'  ? 'bg-emerald-50 text-emerald-600' :
                    d.status === 'offline' ? 'bg-red-50 text-red-400' :
                                            'bg-gray-100 text-gray-400'
                  }`}>
                    {d.status ?? 'unknown'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid #e5e7eb' }}>
          <span className="text-xs text-gray-400">{selected.size} selected</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs py-1.5 px-3">Cancel</button>
            <button
              type="button"
              onClick={confirm}
              disabled={selected.size === 0}
              className="btn-primary text-xs py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add{selected.size > 0 ? ` (${selected.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function CustomerModal({ customer, onClose, onSave }) {
  const isEdit = !!customer?.id
  const [form, setForm] = useState(
    customer?.id
      ? {
          customer_name:  customer.customer_name,
          customer_id:    customer.customer_id,
          email:          customer.email,
          phone:          customer.phone          ?? '',
          address:        customer.address        ?? '',
          state:          customer.state          ?? '',
          country:        customer.country        ?? '',
          custom_fields:  customer.custom_fields  ?? [],
        }
      : { ...EMPTY_FORM, custom_fields: [] }
  )
  const [saving, setSaving]               = useState(false)
  const [showDevicePicker, setShowDevicePicker] = useState(false)
  const [selectedDevices, setSelectedDevices]   = useState(customer?.devices ?? [])
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  const removeDevice = (id) => setSelectedDevices(prev => prev.filter(d => d.id !== id))

  const addField = () => setForm((p) => ({ ...p, custom_fields: [...p.custom_fields, { ...EMPTY_FIELD }] }))
  const removeField = (i) => setForm((p) => ({ ...p, custom_fields: p.custom_fields.filter((_, idx) => idx !== i) }))
  const setField = (i, key, val) =>
    setForm((p) => ({
      ...p,
      custom_fields: p.custom_fields.map((f, idx) => idx === i ? { ...f, [key]: val } : f),
    }))

  const save = async (e) => {
    e.preventDefault()
    for (const f of form.custom_fields) {
      if (!f.name.trim() || !f.title.trim()) {
        toast.error('All custom fields must have both Field Name and Field Title'); return
      }
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        phone:      form.phone   || null,
        address:    form.address || null,
        state:      form.state   || null,
        country:    form.country || null,
        device_ids: selectedDevices.map(d => d.id),
      }
      const { data } = isEdit
        ? await customersAPI.update(customer.id, payload)
        : await customersAPI.create(payload)
      onSave(data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ background: '#fff', border: '1px solid #e5e7eb', maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{isEdit ? 'Edit Customer' : 'New Customer'}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Fill in customer details below</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — scrollable */}
        <form onSubmit={save} className="overflow-y-auto flex-1">
          <div className="p-6 space-y-6">

            {/* ── Basic Details ─────────────────────────────────────── */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4 rounded-full bg-blue-500 flex-shrink-0" />
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Basic Details</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Customer Name *</label>
                  <input className="input" required value={form.customer_name} onChange={set('customer_name')} placeholder="e.g. Acme Corporation" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Customer ID *</label>
                  <input className="input" required value={form.customer_id} onChange={set('customer_id')} placeholder="e.g. CUST-001" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Email Address *</label>
                  <input className="input" type="email" required value={form.email} onChange={set('email')} placeholder="contact@company.com" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Phone Number</label>
                  <input className="input" value={form.phone} onChange={set('phone')} placeholder="+1 (555) 000-0000" />
                </div>
                <div className="col-span-2">
                  <label className="label">Physical Address</label>
                  <input className="input" value={form.address} onChange={set('address')} placeholder="123 Main Street, Suite 400" />
                </div>
                <div>
                  <label className="label">State</label>
                  <input className="input" value={form.state} onChange={set('state')} placeholder="e.g. California" />
                </div>
                <div>
                  <label className="label">Country</label>
                  <input className="input" value={form.country} onChange={set('country')} placeholder="e.g. United States" />
                </div>
              </div>
            </div>

            {/* ── Other Details ─────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-violet-500 flex-shrink-0" />
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Other Details</h3>
                  {form.custom_fields.length > 0 && (
                    <span className="text-[10px] font-semibold bg-violet-50 text-violet-500 border border-violet-200 px-1.5 py-0.5 rounded-full">
                      {form.custom_fields.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={addField}
                  className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 hover:bg-violet-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Field
                </button>
              </div>

              {form.custom_fields.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-8 rounded-xl text-center cursor-pointer transition-colors"
                  style={{ border: '1.5px dashed #e5e7eb' }}
                  onClick={addField}
                >
                  <PlusCircle className="w-7 h-7 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-400">No custom fields yet</p>
                  <p className="text-xs text-gray-300 mt-0.5">Click to add additional details</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_1fr_32px] gap-3 px-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Field Name</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Field Title</span>
                    <span />
                  </div>
                  {form.custom_fields.map((field, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-3 items-center">
                      <input
                        className="input"
                        required
                        placeholder="e.g. Industry"
                        value={field.name}
                        onChange={(e) => setField(i, 'name', e.target.value)}
                      />
                      <input
                        className="input"
                        required
                        placeholder="e.g. Technology"
                        value={field.title}
                        onChange={(e) => setField(i, 'title', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeField(i)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addField}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-violet-600 transition-colors mt-1 pl-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add another field
                  </button>
                </div>
              )}
            </div>

            {/* ── Customer Devices ──────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-emerald-500 flex-shrink-0" />
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Devices</h3>
                  {selectedDevices.length > 0 && (
                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                      {selectedDevices.length}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowDevicePicker(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Device
                </button>
              </div>

              {selectedDevices.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-8 rounded-xl text-center cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ border: '1.5px dashed #e5e7eb' }}
                  onClick={() => setShowDevicePicker(true)}
                >
                  <Monitor className="w-7 h-7 text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-400">No devices attached</p>
                  <p className="text-xs text-gray-300 mt-0.5">Click to attach customer devices</p>
                </div>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
                  <div className="grid grid-cols-[28px_1fr_auto_32px] gap-3 px-4 py-2 items-center" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    <span />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">IP Address</span>
                    <span />
                  </div>
                  <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
                    {selectedDevices.map(d => (
                      <div key={d.id} className="grid grid-cols-[28px_1fr_auto_32px] gap-3 px-4 py-2.5 items-center">
                        <span className="text-base leading-none">{DEVICE_ICONS[d.device_type] ?? '📦'}</span>
                        <p className="text-sm font-medium text-gray-800 truncate">{d.name}</p>
                        <p className="text-xs font-mono text-gray-400">{d.ip_address}</p>
                        <button
                          type="button"
                          onClick={() => removeDevice(d.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2.5" style={{ borderTop: '1px solid #f3f4f6' }}>
                    <button
                      type="button"
                      onClick={() => setShowDevicePicker(true)}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Add another device
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #e5e7eb' }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Customer'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>

        {showDevicePicker && (
          <DevicePickerModal
            onClose={() => setShowDevicePicker(false)}
            onAdd={(picked) => setSelectedDevices(prev => {
              const existingIds = new Set(prev.map(d => d.id))
              return [...prev, ...picked.filter(d => !existingIds.has(d.id))]
            })}
            alreadySelectedIds={new Set(selectedDevices.map(d => d.id))}
          />
        )}
      </div>
    </div>,
    document.body
  )
}

function CustomerRow({ c, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const hasCustomFields = c.custom_fields?.length > 0

  return (
    <div className="border-b last:border-0" style={{ borderColor: '#e5e7eb' }}>
      <div className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 font-bold text-sm flex-shrink-0">
          {c.customer_name?.[0]?.toUpperCase() ?? '?'}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900 truncate">{c.customer_name}</p>
            <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              <Hash className="w-2.5 h-2.5" />{c.customer_id}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{c.email}</span>
            </span>
            {c.phone && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Phone className="w-3 h-3 flex-shrink-0" />{c.phone}
              </span>
            )}
            {(c.state || c.country) && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                {[c.state, c.country].filter(Boolean).join(', ')}
              </span>
            )}
          </div>
        </div>

        {/* Custom fields toggle */}
        {hasCustomFields && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 hover:bg-violet-50 px-2 py-1 rounded-lg transition-colors flex-shrink-0"
          >
            <span className="font-semibold">{c.custom_fields.length} field{c.custom_fields.length !== 1 ? 's' : ''}</span>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onEdit(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(c)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded custom fields */}
      {expanded && hasCustomFields && (
        <div className="px-5 pb-4 pt-0">
          <div className="ml-13 pl-[52px]">
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <div className="grid grid-cols-2 px-4 py-2 bg-gray-50">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Field Name</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Field Title</span>
              </div>
              <div className="divide-y divide-gray-100">
                {c.custom_fields.map((f, i) => (
                  <div key={i} className="grid grid-cols-2 px-4 py-2.5">
                    <span className="text-xs font-medium text-gray-700">{f.name}</span>
                    <span className="text-xs text-gray-500">{f.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CustomerManagement() {
  const [customers, setCustomers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await customersAPI.list({ limit: 50, search: search || undefined })
      setCustomers(data.items ?? [])
      setTotal(data.total ?? 0)
    } catch {
      setCustomers(MOCK)
      setTotal(MOCK.length)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { const t = setTimeout(load, 400); return () => clearTimeout(t) }, [search])

  const handleSave = (customer) => {
    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.id === customer.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = customer; return n }
      return [customer, ...prev]
    })
    setTotal((t) => t + (customers.find((c) => c.id === customer.id) ? 0 : 1))
    toast.success('Customer saved')
  }

  const handleDelete = async (customer) => {
    if (!window.confirm(`Delete customer "${customer.customer_name}"? This cannot be undone.`)) return
    setDeleting(customer.id)
    try {
      await customersAPI.delete(customer.id)
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id))
      setTotal((t) => t - 1)
      toast.success('Customer deleted')
    } catch {
      toast.error('Failed to delete customer')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {modal !== null && (
        <CustomerModal customer={modal} onClose={() => setModal(null)} onSave={handleSave} />
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Customer Management</h1>
          <p className="page-sub">{total} customer{total !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({})}>
          <Plus className="w-4 h-4" />Add Customer
        </button>
      </div>

      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          className="input pl-9 w-full"
          placeholder="Search customers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : customers.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={UserCircle2}
            title="No customers yet"
            description="Add your first customer to start managing their details."
            action={() => setModal({})}
            actionLabel="Add Customer"
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[36px_1fr_auto] gap-4 px-5 py-3" style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <span />
            <span className="th py-0">Customer</span>
            <span className="th py-0">Actions</span>
          </div>
          <div>
            {customers.map((c) => (
              <CustomerRow
                key={c.id}
                c={c}
                onEdit={setModal}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const MOCK = [
  {
    id: 'mock-1',
    customer_name: 'Acme Corporation',
    customer_id: 'CUST-001',
    email: 'it@acme.com',
    phone: '+1 (555) 100-2000',
    address: '123 Commerce Ave',
    state: 'California',
    country: 'United States',
    custom_fields: [
      { name: 'Industry', title: 'Technology' },
      { name: 'Contract Type', title: 'Enterprise Annual' },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-2',
    customer_name: 'Bridgepoint Networks',
    customer_id: 'CUST-002',
    email: 'support@bridgepoint.io',
    phone: '+44 20 7946 0000',
    address: '5 Canary Wharf',
    state: 'London',
    country: 'United Kingdom',
    custom_fields: [],
    created_at: new Date().toISOString(),
  },
]
