import { useState } from 'react'
import ChatWindow from '../components/ChatWindow'
import { aiAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { Bot, FileText, Zap, Shield } from 'lucide-react'

const TABS = [
  ['diagnose', 'Diagnose Issue', Zap],
  ['config', 'Analyze Config', Shield],
  ['logs', 'Interpret Logs', FileText],
  ['chat', 'AI Chat', Bot],
]

const DEVICE_TYPES = ['cisco', 'mikrotik', 'juniper', 'huawei', 'fortinet', 'paloalto', 'linux']
const LOG_TYPES = ['cisco', 'mikrotik', 'juniper', 'linux', 'windows', 'fortinet']

function ResultCard({ children }) {
  return (
    <div className="card p-5 space-y-4 overflow-y-auto max-h-[600px]">{children}</div>
  )
}

function CodeBlock({ cmd }) {
  return (
    <code className="block text-xs bg-gray-900 text-green-400 rounded px-3 py-2 font-mono mb-1">{cmd}</code>
  )
}

export default function AIDiagnostics() {
  const [tab, setTab] = useState('diagnose')

  const [diagnoseForm, setDiagnoseForm] = useState({ description: '', device_info: '', additional_context: '' })
  const [diagnoseResult, setDiagnoseResult] = useState(null)
  const [diagnosing, setDiagnosing] = useState(false)

  const [configText, setConfigText] = useState('')
  const [deviceType, setDeviceType] = useState('cisco')
  const [configResult, setConfigResult] = useState(null)
  const [analyzingConfig, setAnalyzingConfig] = useState(false)

  const [logText, setLogText] = useState('')
  const [logDeviceType, setLogDeviceType] = useState('cisco')
  const [logResult, setLogResult] = useState(null)
  const [analyzingLogs, setAnalyzingLogs] = useState(false)

  const runDiagnose = async (e) => {
    e.preventDefault()
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
    setAnalyzingLogs(true)
    setLogResult(null)
    try {
      const { data } = await aiAPI.interpretLogs({ log_lines: logText, device_type: logDeviceType })
      setLogResult(data)
    } catch { toast.error('Log analysis failed') }
    finally { setAnalyzingLogs(false) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Bot className="w-5 h-5 text-brand-500" /> AI Diagnostics
        </h1>
        <p className="page-sub">Powered by Claude — network engineering AI assistant</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        {TABS.map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition ${
              tab === key ? 'bg-white shadow-sm text-zoho-text' : 'text-zoho-muted hover:text-zoho-text'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* Diagnose */}
      {tab === 'diagnose' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form onSubmit={runDiagnose} className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zoho-text">Describe the Issue</h2>
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
              <Zap className="w-4 h-4" />
              {diagnosing ? 'Analysing…' : 'Run AI Diagnosis'}
            </button>
          </form>

          {diagnoseResult && (
            <ResultCard>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-brand-700">Diagnosis Result</h2>
                <span className="badge bg-brand-50 text-brand-700">
                  {Math.round((diagnoseResult.confidence_score ?? 0) * 100)}% confidence
                </span>
              </div>
              {diagnoseResult.error ? (
                <p className="text-red-600 text-sm">{diagnoseResult.error}</p>
              ) : (
                <>
                  <div>
                    <p className="label">Diagnosis</p>
                    <p className="text-sm text-zoho-text">{diagnoseResult.diagnosis}</p>
                  </div>
                  <div>
                    <p className="label">Root Cause</p>
                    <p className="text-sm text-zoho-text">{diagnoseResult.root_cause}</p>
                  </div>
                  {diagnoseResult.fix_steps?.length > 0 && (
                    <div>
                      <p className="label">Fix Steps</p>
                      <ol className="space-y-1.5">
                        {diagnoseResult.fix_steps.map((step, i) => (
                          <li key={i} className="text-sm text-zoho-text flex gap-2">
                            <span className="text-zoho-muted font-medium flex-shrink-0">{i + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {diagnoseResult.cli_commands?.length > 0 && (
                    <div>
                      <p className="label">CLI Commands</p>
                      {diagnoseResult.cli_commands.map((cmd, i) => <CodeBlock key={i} cmd={cmd} />)}
                    </div>
                  )}
                  {diagnoseResult.escalate_to_human && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      Human engineer review recommended
                    </div>
                  )}
                </>
              )}
            </ResultCard>
          )}
        </div>
      )}

      {/* Config */}
      {tab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form onSubmit={runAnalyzeConfig} className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zoho-text">Paste Device Configuration</h2>
            <div>
              <label className="label">Device Type</label>
              <select className="input" value={deviceType} onChange={(e) => setDeviceType(e.target.value)}>
                {DEVICE_TYPES.map((v) => (
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
              <Shield className="w-4 h-4" />
              {analyzingConfig ? 'Analysing…' : 'Analyze Configuration'}
            </button>
          </form>

          {configResult && (
            <ResultCard>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zoho-text">Security Analysis</h2>
                {configResult.overall_security_score != null && (
                  <span className={`badge ${
                    configResult.overall_security_score >= 80 ? 'bg-green-50 text-green-700' :
                    configResult.overall_security_score >= 50 ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-700'
                  }`}>Score: {configResult.overall_security_score}/100</span>
                )}
              </div>
              {configResult.summary && <p className="text-sm text-zoho-muted">{configResult.summary}</p>}
              {configResult.security_issues?.length > 0 && (
                <div>
                  <p className="label">Security Issues</p>
                  {configResult.security_issues.map((issue, i) => (
                    <div key={i} className={`mb-2 p-3 rounded-lg border-l-4 ${
                      issue.severity === 'critical' ? 'border-red-500 bg-red-50' :
                      issue.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                      'border-amber-500 bg-amber-50'
                    }`}>
                      <p className="text-xs font-semibold uppercase text-zoho-muted">{issue.severity}</p>
                      <p className="text-sm font-medium text-zoho-text">{issue.issue}</p>
                      <p className="text-xs text-zoho-muted mt-1">{issue.recommendation}</p>
                    </div>
                  ))}
                </div>
              )}
              {configResult.optimization_suggestions?.length > 0 && (
                <div>
                  <p className="label">Optimization Suggestions</p>
                  <ul className="space-y-1">
                    {configResult.optimization_suggestions.map((s, i) => (
                      <li key={i} className="text-sm text-zoho-text flex items-start gap-2">
                        <span className="text-brand-500 flex-shrink-0">•</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </ResultCard>
          )}
        </div>
      )}

      {/* Logs */}
      {tab === 'logs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form onSubmit={runInterpretLogs} className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zoho-text">Paste Syslog / Log Output</h2>
            <div>
              <label className="label">Device Type</label>
              <select className="input" value={logDeviceType} onChange={(e) => setLogDeviceType(e.target.value)}>
                {LOG_TYPES.map((v) => (
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
              <FileText className="w-4 h-4" />
              {analyzingLogs ? 'Analysing…' : 'Interpret Logs'}
            </button>
          </form>

          {logResult && (
            <ResultCard>
              <h2 className="text-sm font-semibold text-zoho-text">Log Analysis</h2>
              {logResult.timeline_summary && (
                <p className="text-sm text-zoho-muted">{logResult.timeline_summary}</p>
              )}
              {logResult.requires_immediate_attention && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 font-medium">
                  Requires immediate attention — {logResult.critical_events_count} critical event(s)
                </div>
              )}
              {logResult.error_patterns?.length > 0 && (
                <div>
                  <p className="label">Error Patterns</p>
                  {logResult.error_patterns.map((p, i) => (
                    <div key={i} className={`mb-3 p-3 rounded-lg ${
                      p.severity === 'critical' ? 'bg-red-50' :
                      p.severity === 'warning' ? 'bg-amber-50' : 'bg-blue-50'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium text-zoho-text">{p.pattern}</p>
                        <span className="badge bg-white text-zoho-muted text-xs">{p.occurrences}×</span>
                      </div>
                      <p className="text-xs text-zoho-muted">{p.interpretation}</p>
                      <p className="text-xs text-zoho-muted mt-1 font-medium">→ {p.recommended_action}</p>
                    </div>
                  ))}
                </div>
              )}
            </ResultCard>
          )}
        </div>
      )}

      {/* Chat */}
      {tab === 'chat' && <ChatWindow />}
    </div>
  )
}
