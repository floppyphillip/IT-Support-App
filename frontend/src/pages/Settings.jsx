import { useState, useEffect } from 'react'
import { authAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import useAuth from '../hooks/useAuth'
import { User, Lock, Bell, Users, Plus, Clock, Globe, Search, Wifi, Check, Loader2 } from 'lucide-react'

const NTP_REGIONS = ['Global', 'North America', 'Europe', 'Asia', 'Africa', 'South America', 'Oceania']

const NTP_SERVERS = [
  // Global
  { server: 'pool.ntp.org',                label: 'NTP Pool Project',          region: 'Global'        },
  { server: 'time.cloudflare.com',          label: 'Cloudflare Time',           region: 'Global'        },
  { server: 'time.google.com',              label: 'Google Public NTP',         region: 'Global'        },
  { server: 'time.windows.com',             label: 'Microsoft NTP',             region: 'Global'        },
  { server: 'time.apple.com',              label: 'Apple NTP',                  region: 'Global'        },
  { server: 'time.aws.com',                label: 'Amazon Time Sync',           region: 'Global'        },
  { server: 'time.facebook.com',           label: 'Meta NTP',                   region: 'Global'        },
  // North America
  { server: 'us.pool.ntp.org',             label: 'NTP Pool (US)',              region: 'North America' },
  { server: 'time.nist.gov',               label: 'NIST',                       region: 'North America' },
  { server: 'time-a-g.nist.gov',           label: 'NIST Server A',             region: 'North America' },
  { server: 'time-b-g.nist.gov',           label: 'NIST Server B',             region: 'North America' },
  { server: 'ntp.ubuntu.com',              label: 'Ubuntu NTP',                 region: 'North America' },
  { server: 'ca.pool.ntp.org',             label: 'NTP Pool (Canada)',          region: 'North America' },
  // Europe
  { server: 'europe.pool.ntp.org',         label: 'NTP Pool (Europe)',          region: 'Europe'        },
  { server: 'uk.pool.ntp.org',             label: 'NTP Pool (UK)',              region: 'Europe'        },
  { server: 'de.pool.ntp.org',             label: 'NTP Pool (Germany)',         region: 'Europe'        },
  { server: 'fr.pool.ntp.org',             label: 'NTP Pool (France)',          region: 'Europe'        },
  { server: 'nl.pool.ntp.org',             label: 'NTP Pool (Netherlands)',     region: 'Europe'        },
  { server: 'ptbtime1.ptb.de',             label: 'PTB (Germany)',              region: 'Europe'        },
  { server: 'ptbtime2.ptb.de',             label: 'PTB Backup (Germany)',       region: 'Europe'        },
  { server: 'ntp1.hetzner.de',             label: 'Hetzner (Germany)',          region: 'Europe'        },
  { server: 'ntp.se',                      label: 'Netnod (Sweden)',            region: 'Europe'        },
  { server: 'it.pool.ntp.org',             label: 'NTP Pool (Italy)',           region: 'Europe'        },
  { server: 'es.pool.ntp.org',             label: 'NTP Pool (Spain)',           region: 'Europe'        },
  // Asia
  { server: 'asia.pool.ntp.org',           label: 'NTP Pool (Asia)',            region: 'Asia'          },
  { server: 'cn.pool.ntp.org',             label: 'NTP Pool (China)',           region: 'Asia'          },
  { server: 'jp.pool.ntp.org',             label: 'NTP Pool (Japan)',           region: 'Asia'          },
  { server: 'sg.pool.ntp.org',             label: 'NTP Pool (Singapore)',       region: 'Asia'          },
  { server: 'in.pool.ntp.org',             label: 'NTP Pool (India)',           region: 'Asia'          },
  { server: 'kr.pool.ntp.org',             label: 'NTP Pool (South Korea)',     region: 'Asia'          },
  { server: 'hk.pool.ntp.org',             label: 'NTP Pool (Hong Kong)',       region: 'Asia'          },
  { server: 'ntp.nict.jp',                 label: 'NICT (Japan)',               region: 'Asia'          },
  { server: 'ntp.aliyun.com',              label: 'Alibaba NTP (China)',        region: 'Asia'          },
  { server: 'ntp.tencent.com',             label: 'Tencent NTP (China)',        region: 'Asia'          },
  { server: 'time.stdtime.gov.tw',         label: 'Taiwan Standard Time',       region: 'Asia'          },
  { server: 'id.pool.ntp.org',             label: 'NTP Pool (Indonesia)',       region: 'Asia'          },
  // Africa
  { server: 'africa.pool.ntp.org',         label: 'NTP Pool (Africa)',          region: 'Africa'        },
  { server: 'za.pool.ntp.org',             label: 'NTP Pool (South Africa)',    region: 'Africa'        },
  { server: 'ng.pool.ntp.org',             label: 'NTP Pool (Nigeria)',         region: 'Africa'        },
  { server: 'ke.pool.ntp.org',             label: 'NTP Pool (Kenya)',           region: 'Africa'        },
  { server: 'eg.pool.ntp.org',             label: 'NTP Pool (Egypt)',           region: 'Africa'        },
  // South America
  { server: 'south-america.pool.ntp.org',  label: 'NTP Pool (South America)',   region: 'South America' },
  { server: 'br.pool.ntp.org',             label: 'NTP Pool (Brazil)',          region: 'South America' },
  { server: 'ar.pool.ntp.org',             label: 'NTP Pool (Argentina)',       region: 'South America' },
  { server: 'cl.pool.ntp.org',             label: 'NTP Pool (Chile)',           region: 'South America' },
  { server: 'co.pool.ntp.org',             label: 'NTP Pool (Colombia)',        region: 'South America' },
  // Oceania
  { server: 'oceania.pool.ntp.org',        label: 'NTP Pool (Oceania)',         region: 'Oceania'       },
  { server: 'au.pool.ntp.org',             label: 'NTP Pool (Australia)',       region: 'Oceania'       },
  { server: 'nz.pool.ntp.org',             label: 'NTP Pool (New Zealand)',     region: 'Oceania'       },
]

const ROLE_STYLES = {
  superadmin:        { label: 'Superadmin',        cls: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  admin:             { label: 'Admin',              cls: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  technical_support: { label: 'Technical Support',  cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  noc:               { label: 'NOC',                cls: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  engineer:          { label: 'Engineer',           cls: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  client:            { label: 'Client',             cls: 'bg-gray-100 text-gray-500 border-gray-300' },
}

export default function Settings() {
  const { user, fetchMe, isSuperadmin } = useAuth()
  const [profile, setProfile] = useState({ full_name: user?.full_name ?? '', phone: user?.phone ?? '', telegram_chat_id: user?.telegram_chat_id ?? '', whatsapp_number: user?.whatsapp_number ?? '' })
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm: '' })
  const [notifSettings, setNotifSettings] = useState(null)
  const [teamUsers, setTeamUsers] = useState([])
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'admin', temporary_password: '' })
  const [saving, setSaving] = useState(false)
  const [savingPwd, setSavingPwd] = useState(false)
  const [savingNotif, setSavingNotif] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [tab, setTab] = useState('profile')

  // Date/Time tab state
  const [dtMode, setDtMode]         = useState('ntp')
  const [manualDate, setManualDate] = useState('')
  const [manualTime, setManualTime] = useState('')
  const [ntpServer, setNtpServer]   = useState('pool.ntp.org')
  const [ntpSearch, setNtpSearch]   = useState('')
  const [ntpRegion, setNtpRegion]   = useState('All')
  const [syncing, setSyncing]       = useState(false)
  const [nowStr, setNowStr]         = useState('')

  const isAdminOrAbove = user?.role === 'superadmin' || user?.role === 'admin'

  const TABS = [
    ['profile', 'Profile', User],
    ['notifications', 'Notifications', Bell],
    ...(isSuperadmin?.() ? [['team', 'Team', Users]] : []),
    ...(isAdminOrAbove ? [['datetime', 'Date & Time', Clock]] : []),
  ]

  useEffect(() => {
    authAPI.getNotifications().then(({ data }) => setNotifSettings(data)).catch(() => {})
    if (isSuperadmin?.()) authAPI.listUsers().then(({ data }) => setTeamUsers(data.items || [])).catch(() => {})

    // Load saved datetime settings
    try {
      const saved = JSON.parse(localStorage.getItem('netsupportai-datetime') || '{}')
      if (saved.mode)      setDtMode(saved.mode)
      if (saved.ntpServer) setNtpServer(saved.ntpServer)
    } catch {}

    // Initialise manual fields with current time
    const now = new Date()
    setManualDate(now.toISOString().slice(0, 10))
    setManualTime(now.toTimeString().slice(0, 5))
  }, [])

  // Live clock for manual mode display
  useEffect(() => {
    const tick = () => setNowStr(new Date().toLocaleString())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
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
      setInviteForm({ email: '', full_name: '', role: 'admin', temporary_password: '' })
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

  const applyManual = () => {
    if (!manualDate || !manualTime) return toast.error('Enter both date and time')
    localStorage.setItem('netsupportai-datetime', JSON.stringify({ mode: 'manual', manualDate, manualTime }))
    toast.success(`Time set to ${manualDate} ${manualTime}`)
  }

  const applyNtp = async () => {
    if (!ntpServer) return toast.error('Select an NTP server')
    setSyncing(true)
    await new Promise(r => setTimeout(r, 1500))
    localStorage.setItem('netsupportai-datetime', JSON.stringify({ mode: 'ntp', ntpServer }))
    setSyncing(false)
    toast.success(`Syncing with ${ntpServer}`)
  }

  return (
    <div className="space-y-5 max-w-3xl animate-fade-in">
      <div><h1 className="page-title">Settings</h1><p className="page-sub">Manage your account and preferences</p></div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#f9fafb' }}>
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === key ? 'text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-700'
            }`}
            style={tab === key ? { background: '#e2e8f0' } : {}}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><User className="w-4 h-4 text-gray-400" />Profile</h2>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Full Name</label><input className="input" value={profile.full_name} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} /></div>
                <div><label className="label">Email</label><input className="input opacity-50" value={user?.email ?? ''} disabled /></div>
                <div><label className="label">Phone</label><input className="input" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="+1234567890" /></div>
                <div><label className="label">Role</label><input className="input opacity-50 capitalize" value={user?.role ?? ''} disabled /></div>
                <div><label className="label">Telegram Chat ID</label><input className="input" value={profile.telegram_chat_id} onChange={(e) => setProfile((p) => ({ ...p, telegram_chat_id: e.target.value }))} placeholder="For Telegram notifications" /></div>
                <div><label className="label">WhatsApp Number</label><input className="input" value={profile.whatsapp_number} onChange={(e) => setProfile((p) => ({ ...p, whatsapp_number: e.target.value }))} placeholder="+1234567890" /></div>
              </div>
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
            </form>
          </div>
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Lock className="w-4 h-4 text-gray-400" />Change Password</h2>
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
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Bell className="w-4 h-4 text-gray-400" />Notification Preferences</h2>
          <form onSubmit={saveNotifications} className="space-y-6">
            <div>
              <p className="label mb-3">Channels</p>
              <div className="space-y-3">
                {[['email_enabled','Email notifications'],['telegram_enabled','Telegram (requires Chat ID in Profile)'],['whatsapp_enabled','WhatsApp (requires number in Profile)']].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={notifSettings[key] ?? false} onChange={(e) => setNotifSettings((s) => ({ ...s, [key]: e.target.checked }))} className="rounded" />
                    <span className="text-sm text-gray-700">{label}</span>
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
                    <span className="text-sm text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" className="btn-primary" disabled={savingNotif}>{savingNotif ? 'Saving…' : 'Save Preferences'}</button>
          </form>
        </div>
      )}

      {tab === 'datetime' && (
        <div className="space-y-4">
          {/* Mode selector card */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" /> Date &amp; Time Settings
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Current time: <span className="font-mono text-gray-600">{nowStr}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'manual', label: 'Manual Setting',  desc: 'Set the date and time manually.',              Icon: Clock },
                { key: 'ntp',    label: 'NTP Setting',     desc: 'Synchronise via a public NTP time server.',    Icon: Wifi  },
              ].map(({ key, label, desc, Icon }) => {
                const active = dtMode === key
                return (
                  <button
                    key={key}
                    onClick={() => setDtMode(key)}
                    className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                      active ? 'border-blue-500/40 bg-blue-500/[0.05]' : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg flex-shrink-0 ${active ? 'bg-blue-500/20' : 'bg-gray-100'}`}>
                      <Icon className={`w-4 h-4 ${active ? 'text-blue-500' : 'text-gray-400'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{label}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>
                    </div>
                    {active && <Check className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Manual setting */}
          {dtMode === 'manual' && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Set Date &amp; Time Manually</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={manualDate} onChange={e => setManualDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Time</label>
                  <input type="time" className="input" value={manualTime} onChange={e => setManualTime(e.target.value)} />
                </div>
              </div>
              <button onClick={applyManual} className="btn-primary flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Apply
              </button>
            </div>
          )}

          {/* NTP setting */}
          {dtMode === 'ntp' && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Select NTP Server</h3>
                {ntpServer && (
                  <span className="text-xs font-mono text-blue-500 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                    {ntpServer}
                  </span>
                )}
              </div>

              {/* Search + region filter */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    className="input pl-8"
                    placeholder="Search servers…"
                    value={ntpSearch}
                    onChange={e => setNtpSearch(e.target.value)}
                  />
                </div>
                <select className="input w-48" value={ntpRegion} onChange={e => setNtpRegion(e.target.value)}>
                  <option value="All">All Regions</option>
                  {NTP_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Server list */}
              <div className="rounded-xl border border-gray-200 overflow-hidden mb-4" style={{ maxHeight: 360, overflowY: 'auto' }}>
                {NTP_REGIONS.filter(r => ntpRegion === 'All' || r === ntpRegion).map(region => {
                  const servers = NTP_SERVERS.filter(s =>
                    s.region === region && (
                      !ntpSearch ||
                      s.server.toLowerCase().includes(ntpSearch.toLowerCase()) ||
                      s.label.toLowerCase().includes(ntpSearch.toLowerCase())
                    )
                  )
                  if (!servers.length) return null
                  return (
                    <div key={region}>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Globe className="w-3 h-3" /> {region}
                        </p>
                      </div>
                      {servers.map((s, idx) => {
                        const isSel = ntpServer === s.server
                        return (
                          <div
                            key={s.server}
                            onClick={() => setNtpServer(s.server)}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                              idx < servers.length - 1 ? 'border-b border-gray-100' : ''
                            } ${isSel ? 'bg-blue-500/[0.05]' : 'hover:bg-gray-50'}`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSel ? 'border-blue-500' : 'border-gray-300'}`}>
                              {isSel && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{s.label}</p>
                              <p className="text-xs font-mono text-gray-400">{s.server}</p>
                            </div>
                            <span className="text-[10px] font-semibold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0 capitalize">
                              {region}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              <button onClick={applyNtp} disabled={!ntpServer || syncing} className="btn-primary flex items-center gap-2">
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                {syncing ? 'Syncing…' : 'Apply & Sync'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'team' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-gray-400" />Invite Team Member</h2>
            <form onSubmit={inviteUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Email *</label><input className="input" type="email" required value={inviteForm.email} onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Full Name *</label><input className="input" required value={inviteForm.full_name} onChange={(e) => setInviteForm((f) => ({ ...f, full_name: e.target.value }))} /></div>
                <div>
                  <label className="label">Role</label>
                  <select className="input" value={inviteForm.role} onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}>
                    <option value="admin">Admin</option>
                    <option value="technical_support">Technical Support</option>
                    <option value="noc">NOC</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
                <div><label className="label">Temporary Password *</label><input className="input" type="password" required minLength={8} value={inviteForm.temporary_password} onChange={(e) => setInviteForm((f) => ({ ...f, temporary_password: e.target.value }))} /></div>
              </div>
              <button type="submit" className="btn-primary" disabled={inviting}>{inviting ? 'Inviting…' : 'Send Invite'}</button>
            </form>
          </div>
          <div className="card overflow-hidden">
            <div className="card-header"><h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" />Team ({teamUsers.length})</h2></div>
            <div className="divide-y" style={{ borderColor: '#e5e7eb' }}>
              {teamUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-all duration-200">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-semibold text-white flex-shrink-0">{u.full_name?.[0] ?? '?'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{u.full_name}</p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </div>
                  <span className={`badge border ${ROLE_STYLES[u.role]?.cls ?? 'bg-gray-100 text-gray-500 border-gray-300'}`}>{ROLE_STYLES[u.role]?.label ?? u.role}</span>
                  <button onClick={() => toggleUserActive(u.id, u.is_active)} disabled={u.id === user?.id}
                    className={`text-xs px-2.5 py-1 rounded-lg transition-all duration-200 disabled:opacity-30 ${u.is_active ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
