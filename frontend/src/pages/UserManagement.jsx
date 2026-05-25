import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { authAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import {
  Plus, Search, Edit2, X, UserPlus, Users,
  ShieldCheck, Headphones, Radio, Crown,
} from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { SkeletonTable } from '../components/Skeleton'
import useAuth from '../hooks/useAuth'

const STAFF_ROLES = [
  { value: 'admin',             label: 'Admin',             icon: ShieldCheck, cls: 'bg-purple-50 text-purple-600 border-purple-200'  },
  { value: 'technical_support', label: 'Technical Support', icon: Headphones,  cls: 'bg-blue-50 text-blue-600 border-blue-200'         },
  { value: 'noc',               label: 'NOC',               icon: Radio,       cls: 'bg-cyan-50 text-cyan-600 border-cyan-200'          },
  { value: 'superadmin',        label: 'Superadmin',        icon: Crown,       cls: 'bg-violet-50 text-violet-600 border-violet-200'    },
]

const ROLE_MAP = Object.fromEntries(STAFF_ROLES.map((r) => [r.value, r]))

const EMPTY_FORM = { full_name: '', email: '', role: 'admin', temporary_password: '', confirm_password: '' }

function RoleBadge({ role }) {
  const r = ROLE_MAP[role]
  if (!r) return <span className="badge bg-gray-100 text-gray-500 border border-gray-200 capitalize">{role?.replace('_', ' ')}</span>
  const Icon = r.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.cls}`}>
      <Icon className="w-2.5 h-2.5" />{r.label}
    </span>
  )
}

function UserModal({ editUser, onClose, onSave }) {
  const isEdit = !!editUser?.id
  const [form, setForm] = useState(
    isEdit
      ? { full_name: editUser.full_name, email: editUser.email, role: editUser.role, temporary_password: '', confirm_password: '' }
      : { ...EMPTY_FORM }
  )
  const [saving, setSaving] = useState(false)
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    if (!isEdit) {
      if (form.temporary_password !== form.confirm_password) { toast.error('Passwords do not match'); return }
      if (form.temporary_password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    }
    setSaving(true)
    try {
      if (isEdit) {
        const { data } = await authAPI.updateUser(editUser.id, { full_name: form.full_name, role: form.role })
        onSave(data)
      } else {
        await authAPI.inviteUser({ full_name: form.full_name, email: form.email, role: form.role, temporary_password: form.temporary_password })
        onSave()
      }
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
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{isEdit ? 'Edit User' : 'Create Staff User'}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{isEdit ? 'Update role or name' : 'User will be prompted to change password on first login'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={save} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name *</label>
              <input className="input" required value={form.full_name} onChange={set('full_name')} placeholder="e.g. Jane Doe" />
            </div>
            <div className="col-span-2">
              <label className="label">Email Address *</label>
              <input className="input" type="email" required disabled={isEdit} value={form.email} onChange={set('email')} placeholder="jane@company.com"
                style={isEdit ? { opacity: 0.5, cursor: 'not-allowed' } : {}} />
            </div>
            <div className="col-span-2">
              <label className="label">Role *</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {STAFF_ROLES.filter((r) => r.value !== 'superadmin').map((r) => {
                  const Icon = r.icon
                  const selected = form.role === r.value
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, role: r.value }))}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all text-center ${
                        selected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${selected ? 'text-blue-500' : 'text-gray-400'}`} />
                      <span className={`text-[11px] font-semibold leading-tight ${selected ? 'text-blue-600' : 'text-gray-500'}`}>
                        {r.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
            {!isEdit && (
              <>
                <div>
                  <label className="label">Temporary Password *</label>
                  <input className="input" type="password" required minLength={8} value={form.temporary_password} onChange={set('temporary_password')} placeholder="Min. 8 characters" />
                </div>
                <div>
                  <label className="label">Confirm Password *</label>
                  <input className="input" type="password" required value={form.confirm_password} onChange={set('confirm_password')} placeholder="Re-enter password" />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-2" style={{ borderTop: '1px solid #e5e7eb' }}>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default function UserManagement() {
  const { user: me } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await authAPI.listUsers()
      setUsers((data.items ?? []).filter((u) => u.role !== 'client'))
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = (updatedUser) => {
    if (updatedUser) {
      setUsers((prev) => {
        const idx = prev.findIndex((u) => u.id === updatedUser.id)
        if (idx >= 0) { const n = [...prev]; n[idx] = updatedUser; return n }
        return prev
      })
    } else {
      load()
    }
    toast.success('User saved')
  }

  const toggleActive = async (u) => {
    try {
      const { data } = await authAPI.updateUser(u.id, { is_active: !u.is_active })
      setUsers((prev) => prev.map((x) => x.id === data.id ? data : x))
      toast.success(u.is_active ? 'User deactivated' : 'User activated')
    } catch { toast.error('Failed') }
  }

  const filtered = users.filter((u) =>
    !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {modal !== null && (
        <UserModal editUser={modal?.id ? modal : null} onClose={() => setModal(null)} onSave={handleSave} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-sub">{users.length} staff member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({})}>
          <Plus className="w-4 h-4" />Create User
        </button>
      </div>

      {/* Role summary chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {STAFF_ROLES.map((r) => {
          const count = users.filter((u) => u.role === r.value).length
          if (!count) return null
          return (
            <span key={r.value} className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${r.cls}`}>
              {count} {r.label}
            </span>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input className="input pl-9 w-full" placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title={search ? 'No users match your search' : 'No staff users yet'}
            description={search ? 'Try a different name or email.' : 'Create your first staff user to get started.'}
            action={search ? undefined : () => setModal({})}
            actionLabel="Create User"
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Table head */}
          <div
            className="hidden md:grid gap-4 px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider"
            style={{ gridTemplateColumns: '40px 1fr 160px 100px 100px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}
          >
            <span />
            <span>User</span>
            <span>Role</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          <div className="divide-y" style={{ borderColor: '#e5e7eb' }}>
            {filtered.map((u) => (
              <div
                key={u.id}
                className="hidden md:grid items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
                style={{ gridTemplateColumns: '40px 1fr 160px 100px 100px' }}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {u.full_name?.[0]?.toUpperCase() ?? '?'}
                </div>

                {/* Name / email */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                    {u.id === me?.id && (
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-500 border border-blue-200 px-1.5 py-0.5 rounded-full">you</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>

                {/* Role */}
                <RoleBadge role={u.role} />

                {/* Status */}
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  u.is_active
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-gray-100 text-gray-400 border-gray-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setModal(u)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                    title="Edit user"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleActive(u)}
                    disabled={u.id === me?.id}
                    className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      u.is_active
                        ? 'bg-red-50 text-red-500 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}

            {/* Mobile cards */}
            {filtered.map((u) => (
              <div key={`m-${u.id}`} className="md:hidden p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                      {u.full_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </div>
                  </div>
                  <button onClick={() => setModal(u)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-3 pl-12">
                  <RoleBadge role={u.role} />
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    u.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
