import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import useAuth from '../hooks/useAuth'
import { Monitor, ArrowRight, Shield, Zap, Users } from 'lucide-react'

const FEATURES = [
  { icon: Zap,    title: 'AI Auto-Triage',   desc: 'Tickets diagnosed and resolved automatically by Claude AI' },
  { icon: Shield, title: 'SLA Tracking',      desc: 'Real-time breach alerts and automatic escalation' },
  { icon: Users,  title: 'Multi-role Access', desc: 'Superadmin, engineer and client portals' },
]

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.email, form.password)
      toast.success('Welcome back!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex lg:w-5/12 flex-col justify-between p-10"
        style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <Monitor className="w-4 h-4 text-white" />
          </div>
          <span style={{ color: 'var(--text-1)', fontSize: 14, fontWeight: 700 }}>NetSupportAI</span>
        </div>

        <div>
          <h1 style={{ color: 'var(--text-1)', fontSize: 30, fontWeight: 700, lineHeight: 'var(--lh-small)', marginBottom: 12 }}>
            Smarter IT support,<br />powered by AI.
          </h1>
          <p style={{ color: 'var(--text-4)', fontSize: 13, lineHeight: 'var(--lh-large)', marginBottom: 32 }}>
            Monitor devices, manage tickets, and resolve issues faster with Claude AI.
          </p>
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'var(--blue-dim)', border: '1px solid var(--border-mid)' }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: 'var(--blue-text)' }} />
                </div>
                <div>
                  <p style={{ color: 'var(--text-1)', fontSize: 12, fontWeight: 600, lineHeight: 'var(--lh-small)' }}>{title}</p>
                  <p style={{ color: 'var(--text-4)', fontSize: 11, lineHeight: 'var(--lh-large)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: 'var(--text-4)', fontSize: 10 }}>© {new Date().getFullYear()} NetSupportAI. All rights reserved.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Monitor className="w-4 h-4 text-white" />
            </div>
            <span style={{ color: 'var(--text-1)', fontSize: 14, fontWeight: 700 }}>NetSupportAI</span>
          </div>

          <div className="card p-7">
            <h2 style={{ color: 'var(--text-1)', fontSize: 18, fontWeight: 700, lineHeight: 'var(--lh-small)', marginBottom: 4 }}>Sign in</h2>
            <p style={{ color: 'var(--text-4)', fontSize: 11, marginBottom: 24 }}>Enter your credentials to continue</p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">Email address</label>
                <input type="email" className="input" placeholder="you@company.com"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoFocus />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" placeholder="••••••••"
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <button type="submit" className="btn-primary w-full justify-center" style={{ paddingTop: 10, paddingBottom: 10 }} disabled={loading}>
                {loading ? 'Signing in…' : <><ArrowRight className="w-3.5 h-3.5" />Sign in</>}
              </button>
            </form>

            <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border)' }}>
              <p style={{ color: 'var(--text-4)', fontSize: 11, textAlign: 'center' }}>
                Client?{' '}
                <a href="/client-portal" style={{ color: 'var(--blue-text)', fontWeight: 500 }}>Access the client portal</a>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-4" style={{ color: 'var(--text-4)', fontSize: 10 }}>
            <Shield className="w-3 h-3" /><span>Secured with JWT + bcrypt</span>
          </div>
        </div>
      </div>
    </div>
  )
}
