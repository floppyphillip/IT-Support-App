import { useState } from 'react'
import ChatWindow from '../components/ChatWindow'
import { aiAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { Bot, FileText, Zap, Shield } from 'lucide-react'

export default function AIDiagnostics() {
  const [tab, setTab] = useState('diagnose') // 'diagnose' | 'config' | 'logs' | 'chat'

  // Tab 1: Diagnose Issue
  const [diagnoseForm, setDiagnoseForm] = useState({ description: '', device_info: '', additional_context: '' })
  const [diagnoseResult, setDiagnoseResult] = useState(null)
  const [diagnosing, setDiagnosing] = useState(false)

  // Tab 2: Analyze Config
  const [configText, setConfigText] = useState('')
  const [deviceType, setDeviceType] = useState('cisco')
  const [configResult, setConfigResult] = useState(null)
  const [analyzingConfig, setAnalyzingConfig] = useState(false)

  // Tab 3: Interpret Logs
  const [logText, setLogText] = useState('')
  const [logDeviceType, setLogDeviceType] = useState('cisco')
  const [logResult, setLogResult] = useState(null)
  const [analyzingLogs, setAnalyzingLogs] = useState(false)

  const runDiagnose = async (e) => {
    e.preventDefault()
    if (!diagnoseForm.description.trim()) return
    setDiagnosing(true)
    setDiagnoseResult(null)
    try {
      const { data } = await aiAPI.diagnose(diagnoseForm)
      setDiagnoseResult(data)
    } catch { toast.error('Diagnosis failed') }
    finally { setDiagnosing(false) }
  }

  const runAnalyzeConfig = async (e) => {
    e.preventDefault()
    if (!configText.trim()) return
    setAnalyzingConfig(true)
    setConfigResult(null)
    try {
      const { data } = await aiAPI.analyzeConfig({ config_text: configText, device_type: deviceType })
      setConfigResult(data)
    } catch { toast.error('Config analysis failed') }
    finally { setAnalyzingConfig(false) }
  }

  const runInterpretLogs = async (e) => {
    e.preventDefault()
    if (!logText.trim()) return
    setAnalyzingLogs(true)
    setLogResult(null)
    try {
      const { data } = await aiAPI.interpretLogs({ log_lines: logText, device_type: logDeviceType })
      setLogResult(data)
    } catch { toast.error('Log analysis failed') }
    finally { setAnalyzingLogs(false) }
  }

  const TABS = [
    ['diagnose', 'Diagnose Issue', Zap],
    ['config', 'Analyze Config', Shield],
    ['logs', 'Interpret Logs', FileText],
    ['chat', 'AI Chat', Bot],
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bot className="w-6 h-6 text-brand-600" /> AI Diagnostics
        </h1>
        <p className="text-sm text-gray-500 mt-1">Powered by Claude — network engineering AI assistant</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
        {TABS.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${
              tab === key ? 'bg-white shadow text-brand-700' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Diagnose Issue ──────────────────────────────────────── */}
      {tab === 'diagnose' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={runDiagnose} className="card p-6 space-y-4">
            <h2 className="font-semibold">Describe the Issue</h2>
            <div>
              <label className="label">Issue Description *</label>
              <textarea
                className="input h-32 resize-none"
                required
                value={diagnoseForm.description}
                onChange={(e) => setDiagnoseForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe symptoms, error messages, affected users, recent changes…"
              />
            </div>
            <div>
              <label className="label">Device Info</label>
              <input
                className="input"
                value={diagnoseForm.device_info}
                onChange={(e) => setDiagnoseForm((f) => ({ ...f, device_info: e.target.value }))}
                placeholder="e.g. Cisco ISR 4451, IP 10.0.1.1, IOS-XE 17.9"
              />
            </div>
            <div>
              <label className="label">Additional Context</label>
              <textarea
                className="input h-20 resize-none"
                value={diagnoseForm.additional_context}
                onChange={(e) => setDiagnoseForm((f) => ({ ...f, additional_context: e.target.value }))}
                placeholder="Network topology, recent changes, error logs…"
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={diagnosing}>
              {diagnosing ? 'Analysing…' : '⚡ Run AI Diagnosis'}
            </button>
          </form>

          {diagnoseResult && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-brand-700">Diagnosis Result</h2>
                <span className="badge bg-brand-50 text-brand-700">
                  {Math.round((diagnoseResult.confidence_score ?? 0) * 100)}% confidence
                </span>
              </div>
              {diagnoseResult.error ? (
                <p className="text-red-600 text-sm">{diagnoseResult.error}</p>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">Diagnosis</p>
                    <p className="text-sm text-gray-800">{diagnoseResult.diagnosis}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">Root Cause</p>
                    <p className="text-sm text-gray-800">{diagnoseResult.root_cause}</p>
                  </div>
                  {diagnoseResult.fix_steps?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">Fix Steps</p>
                      <ol className="space-y-1">
                        {diagnoseResult.fix_steps.map((step, i) => (
                          <li key={i} className="text-sm text-gray-700">
                            <span className="text-gray-400 font-medium">{i + 1}.</span> {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {diagnoseResult.cli_commands?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 font-medium mb-2">CLI Commands</p>
                      {diagnoseResult.cli_commands.map((cmd, i) => (
                        <code key={i} className="block text-xs bg-gray-900 text-green-400 rounded px-3 py-1.5 font-mono mb-1">
                          {cmd}
                        </code>
                      ))}
                    </div>
                  )}
                  {diagnoseResult.escalate_to_human && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      ⚠ Human engineer review recommended
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Analyze Config ─────────────────────────────────────── */}
      {tab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={runAnalyzeConfig} className="card p-6 space-y-4">
            <h2 className="font-semibold">Paste Device Configuration</h2>
            <div>
              <label className="label">Device Type</label>
              <select className="input" value={deviceType} onChange={(e) => setDeviceType(e.target.value)}>
                {['cisco', 'mikrotik', 'juniper', 'huawei', 'fortinet', 'paloalto', 'linux'].map((v) => (
                  <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Configuration *</label>
              <textarea
                className="input h-72 resize-none font-mono text-xs"
                required
                placeholder="Paste show running-config, /export, or similar output here…"
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={analyzingConfig}>
              {analyzingConfig ? 'Analysing…' : '🔍 Analyze Configuration'}
            </button>
          </form>

          {configResult && (
            <div className="card p-6 space-y-4 overflow-y-auto max-h-[600px]">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Security Analysis</h2>
                {configResult.overall_security_score != null && (
                  <span className={`badge ${
                    configResult.overall_security_score >= 80 ? 'bg-green-100 text-green-700' :
                    configResult.overall_security_score >= 50 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>Score: {configResult.overall_security_score}/100</span>
                )}
              </div>
              {configResult.summary && <p className="text-sm text-gray-700">{configResult.summary}</p>}
              {configResult.security_issues?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Security Issues</p>
                  {configResult.security_issues.map((issue, i) => (
                    <div key={i} className={`mb-2 p-3 rounded-lg border-l-4 ${
                      issue.severity === 'critical' ? 'border-red-500 bg-red-50' :
                      issue.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                      'border-yellow-500 bg-yellow-50'
                    }`}>
                      <p className="text-xs font-medium uppercase text-gray-500">{issue.severity}</p>
                      <p className="text-sm font-medium text-gray-800">{issue.issue}</p>
                      <p className="text-xs text-gray-600 mt-1">{issue.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}
              {configResult.optimization_suggestions?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Optimization Suggestions</p>
                  <ul className="space-y-1">
                    {configResult.optimization_suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-brand-500 flex-shrink-0">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Interpret Logs ─────────────────────────────────────── */}
      {tab === 'logs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={runInterpretLogs} className="card p-6 space-y-4">
            <h2 className="font-semibold">Paste Syslog / Log Output</h2>
            <div>
              <label className="label">Device Type</label>
              <select className="input" value={logDeviceType} onChange={(e) => setLogDeviceType(e.target.value)}>
                {['cisco', 'mikrotik', 'juniper', 'linux', 'windows', 'fortinet'].map((v) => (
                  <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Log Output *</label>
              <textarea
                className="input h-72 resize-none font-mono text-xs"
                required
                placeholder="Paste syslog, dmesg, event viewer, or any network logs here…"
                value={logText}
                onChange={(e) => setLogText(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={analyzingLogs}>
              {analyzingLogs ? 'Analysing…' : '🔍 Interpret Logs'}
            </button>
          </form>

          {logResult && (
            <div className="card p-6 space-y-4 overflow-y-auto max-h-[600px]">
              <h2 className="font-semibold text-gray-900">Log Analysis</h2>
              {logResult.timeline_summary && (
                <p className="text-sm text-gray-700">{logResult.timeline_summary}</p>
              )}
              {logResult.requires_immediate_attention && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 font-medium">
                  ⚠ Requires immediate attention — {logResult.critical_events_count} critical event(s)
                </div>
              )}
              {logResult.error_patterns?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Error Patterns</p>
                  {logResult.error_patterns.map((p, i) => (
                    <div key={i} className={`mb-3 p-3 rounded-lg ${
                      p.severity === 'critical' ? 'bg-red-50' :
                      p.severity === 'warning' ? 'bg-yellow-50' : 'bg-blue-50'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-gray-800">{p.pattern}</p>
                        <span className="badge bg-white text-gray-600 text-xs">{p.occurrences}x</span>
                      </div>
                      <p className="text-xs text-gray-600">{p.interpretation}</p>
                      <p className="text-xs text-gray-500 mt-1 font-medium">→ {p.recommended_action}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab 4: Chat ───────────────────────────────────────────────── */}
      {tab === 'chat' && <ChatWindow />}
    </div>
  )
}
