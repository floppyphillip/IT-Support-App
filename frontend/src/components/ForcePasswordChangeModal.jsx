import { useState, useEffect } from 'react'
import useAuthStore from '../store/authStore'
import { authAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { KeyRound, ShieldAlert } from 'lucide-react'

export default function ForcePasswordChangeModal({ light = false }) {
  const updateUser = useAuthStore((s) => s.updateUser)
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const set = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }))

  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (form.new_password !== form.confirm) { toast.error('Passwords do not match'); return }
    if (form.new_password.length < 8) { toast.error('New password must be at least 8 characters'); return }
    setSaving(true)
    try {
      await authAPI.changePassword({ current_password: form.current_password, new_password: form.new_password })
      updateUser({ force_password_change: false })
      toast.success('Password updated — welcome!')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to update password')
    } finally {
      setSaving(false)
    }
  }

  if (light) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}>
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
          <div className="px-6 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Password Change Required</h2>
                <p className="text-xs text-slate-500 mt-0.5">You must set a new password before continuing.</p>
              </div>
            </div>
          </div>
          <form onSubmit={submit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current Password</label>
              <input
                type="password"
                required
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
                placeholder="Your temporary password"
                value={form.current_password}
                onChange={set('current_password')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">New Password</label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
                placeholder="Min. 8 characters"
                value={form.new_password}
                onChange={set('new_password')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                required
                className="w-full bg-slate-50 border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-lg px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition-all"
                placeholder="Re-enter new password"
                value={form.confirm}
                onChange={set('confirm')}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
              <KeyRound className="w-4 h-4" />
              {saving ? 'Updating…' : 'Set New Password'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.10)' }}>
        <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Password Change Required</h2>
              <p className="text-xs text-slate-400 mt-0.5">You must set a new password before continuing.</p>
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              required
              autoFocus
              className="w-full bg-[#1a2236] border border-white/[0.07] focus:border-blue-500/50 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors"
              placeholder="Your temporary password"
              value={form.current_password}
              onChange={set('current_password')}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full bg-[#1a2236] border border-white/[0.07] focus:border-blue-500/50 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors"
              placeholder="Min. 8 characters"
              value={form.new_password}
              onChange={set('new_password')}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              className="w-full bg-[#1a2236] border border-white/[0.07] focus:border-blue-500/50 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors"
              placeholder="Re-enter new password"
              value={form.confirm}
              onChange={set('confirm')}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
            <KeyRound className="w-4 h-4" />
            {saving ? 'Updating…' : 'Set New Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
