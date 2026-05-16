import { useState, useEffect } from 'react'
import { authAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import useAuth from '../hooks/useAuth'
import { User, Lock, Bell, Users, Plus } from 'lucide-react'

export default function Settings() {
  const { user, fetchMe, isSuperadmin } = useAuth()
  const [profile, setProfile] = useState({ full_name: user?.full_name ?? '', phone: user?.phone ?? '', telegram_chat_id: user?.telegram_chat_id ?? '', whatsapp_number: user?.whatsapp_number ?? '' })
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm: '' })
  const [notifSettings, setNotifSettings] = useState(null)
  const [teamUsers, setTeamUsers] = useState([])
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'engineer', temporary_password: '' })
  const [saving, setSaving] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [savingNotif, setSavingNotif] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [tab, setTab] = useState('profile')

  const TABS = [['profile', 'Profile', User], ['notifications', 'Notifications', Bell], ...(isSuperadmin?.() ? [['team', 'Team', Users]] : [])]

  useEffect(() => {
    authAPI.getNotifications().then(({ data }) => setNotifSettings(data)).catch(() => {})
    if (isSuperadmin?.()) authAPI.listUsers().then(({ data }) => setTeamUsers(data.items || [])).catch(() => {})
  }, [])

  const saveProfile = async (e) => {
    e.preventDefault(); setSaving(true)
    try { await authAPI.updateMe(profile); await fetchMe(); toast.success('Profile updated') }
    catch (err) { toast.error(err.response?.data?.detail || 'Save failed') }
    finally { setSaving(false) }
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (pwd.new_password !== pwd.confirm) return toast.error('Passwords do not match')
    setSavingPwd(true)
    try { await authAPI.changePassword({ current_password: pwd.current_password, new_password: pwd.new_password }); toast.success('Password changed'); setPwd({ current_password: '', new_password: '', confirm: '' }) }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setSavingPwd(false) }
  }

  const saveNotifications = async (e) => {
    e.preventDefault(); setSavingNotif(true)
    try { const { data } = await authAPI.updateNotifications(notifSettings); setNotifSettings(data); toast.success('Preferences saved') }
    catch { toast.error('Failed') }
    finally { setSavingNotif(false) }
  }

  const inviteUser = async (e) => {
    e.preventDefault(); setInviting(true)
    try {
      await authAPI.inviteUser(inviteForm)
      toast.success(`User ${inviteForm.email} invited`)
      setInviteForm({ email: '', full_name: '', role: 'engineer', temporary_password: '' })
      const { data } = await authAPI.listUsers(); setTeamUsers(data.items || [])
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setInviting(false) }
  }

  const toggleUserActive = async (userId, isActive) => {
    try {
      await authAPI.updateUser(userId, { is_active: !isActive })
      setTeamUsers((users) => users.map((u) => u.id === userId ? { ...u, is_active: !isActive } : u))
      toast.success(isActive ? 'User deactivated' : 'User activated')
    } catch { toast.error('Failed') }
  }

  return (
    <div className="space-y-5 max-w-3xl animate-fade-in">
      <div><h1 className="page-title">Settings</h1><p className="page-sub">Manage your account and preferences</p></div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${tab === key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          ><Icon className="w-3.5 h-3.5" />{label}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-slate-400" />Profile</h2>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Full Name</label><input className="input" value={profile.full_name} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} /></div>
                <div><label className="label">Email</label><input className="input bg-slate-50 text-slate-400" value={user?.email ?? ''} disabled /></div>
                <div><label className="label">Phone</label><input className="input" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+1234567890" /></div>
                <div><label className="label">Role</label><input className="input bg-slate-50 text-slate-400 capitalize" value={user?.role ?? ''} disabled /></div>
                <div><label className="label">Telegram Chat ID</label><input className="input" value={profile.telegram_chat_id} onChange={(e) => setProfile((p) => ({ ...p, telegram_chat_id: e.target.value }))} placeholder="For Telegram notifications" /></div>
                <div><label className="label">WhatsApp Number</label><input className="input" value={profile.whatsapp_number} onChange={(e) => setProfile((p) => ({ ...p, whatsapp_number: e.target.value }))} placeholder="+1234567890" /></div>
              </div>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
            </form>
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Lock className="w-4 h-4 text-slate-400" />Change Password</h2>
            <form onSubmit={changePassword} className="space-y-4">
              <div><label className="label">Current Password</label><input className="input" type="password" value={pwd.current_password} required onChange={(e) => setPwd((p) => ({ ...p, current_password: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">New Password</label><input className="input" type="password" value={pwd.new_password} required minLength={8} onChange={(e) => setPwd((p) => ({ ...p, new_password: e.target.value }))} /></div>
                <div><label className="label">Confirm Password</label><input className="input" type="password" value={pwd.confirm} required onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} /></div>
              </div>
              <button type="submit" className="btn-primary" disabled={savingPwd}>{savingPwd ? 'Changing…' : 'Change Password'}</button>
            </form>
          </div>
        </div>
      )}

      {tab === 'notifications' && notifSettings && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-slate-400" />Notification Preferences</h2>
          <form onSubmit={saveNotifications} className="space-y-6">
            <div>
              <p className="label mb-3">Channels</p>
              <div className="space-y-3">
                {[['email_enabled','Email notifications'],['telegram_enabled','Telegram (requires Chat ID in Profile)'],['whatsapp_enabled','WhatsApp (requires number in Profile)']].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={notifSettings[key] ?? false} onChange={(e) => setNotifSettings((s) => ({ ...s, [key]: e.target.checked }))} className="rounded" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="label mb-3">Alert On</p>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(notifSettings.alert_on ?? {}).map(([key, val]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={val} onChange={(e) => setNotifSettings((s) => ({ ...s, alert_on: { ...s.alert_on, [key]: e.target.checked } }))} className="rounded" />
                    <span className="text-sm text-slate-700 capitalize">{key.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={savingNotif}>{savingNotif ? 'Saving…' : 'Save Preferences'}</button>
          </form>
        </div>
      )}

      {tab === 'team' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-slate-400" />Invite Team Member</h2>
            <form onSubmit={inviteUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Email *</label><input className="input" type="email" required value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Full Name *</label><input className="input" required value={inviteForm.full_name} onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}>
                    <option value="engineer">Engineer</option><option value="client">Client</option><option value="superadmin">Superadmin</option>
                  </select>
                </div>
                <div><label className="label">Temporary Password *</label><input className="input" type="password" required minLength={8} value={inviteForm.temporary_password} onChange={(e) => setInviteForm((f) => ({ ...f, temporary_password: e.target.value }))} /></div>
              </div>
              <button type="submit" className="btn-primary" disabled={inviting}>{inviting ? 'Inviting…' : 'Send Invite'}</button>
            </form>
          </div>
          <div className="card overflow-hidden">
            <div className="card-header"><h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" />Team ({teamUsers.length})</h2></div>
            <div className="divide-y divide-slate-100">
              {teamUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">{u.full_name?.[0] ?? '?'}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-900">{u.full_name}</p><p className="text-xs text-slate-500">{u.email}</p></div>
                  <span className={`badge border capitalize ${u.role === 'superadmin' ? 'bg-violet-50 text-violet-700 border-violet-100' : u.role === 'engineer' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{u.role}</span>
                  <button onClick={() => toggleUserActive(u.id, u.is_active)} disabled={u.id === user?.id} className={`text-xs px-2.5 py-1 rounded-lg transition-all duration-200 disabled:opacity-30 ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>{u.is_active ? 'Deactivate' : 'Activate'}</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
