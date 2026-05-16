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
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-slate-900 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Monitor className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg">NetSupportAI</span>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Smarter IT support,<br />powered by AI.
          </h1>
          <p className="text-slate-400 text-lg mb-10">
            Monitor devices, manage tickets, and resolve issues faster with Claude AI.
          </p>
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-slate-400 text-sm">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">
          © {new Date().getFullYear()} NetSupportAI. All rights reserved.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-slate-50 p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center">
              <Monitor className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">NetSupportAI</span>
          </div>

          <div className="card p-8">
            <h2 className="text-xl font-bold text-slate-900 mb-1">Sign in</h2>
            <p className="text-sm text-slate-500 mb-6">Enter your credentials to continue</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Email address</label>
                <input type="email" className="input" placeholder="you@company.com" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} required autoFocus />
              </div>
              <div>
                <label className="label">Password</label>
                <input type="password" className="input" placeholder="••••••••" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} required />
              </div>
              <button type="submit" className="btn-primary w-full justify-center py-2.5 mt-1" disabled={loading}>
                {loading ? 'Signing in…' : <><ArrowRight className="w-4 h-4" />Sign in</>}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center">
                Client?{' '}
                <a href="/client-portal" className="text-blue-600 hover:text-blue-700 font-medium transition-all duration-200">
                  Access the client portal
                </a>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-5 text-xs text-slate-400">
            <Shield className="w-3 h-3" />
            <span>Secured with JWT + bcrypt</span>
          </div>
        </div>
      </div>
    </div>
  )
}
