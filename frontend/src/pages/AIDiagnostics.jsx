import { useState } from 'react'
import ChatWindow from '../components/ChatWindow'
import { aiAPI } from '../api/client'
import { toast } from 'react-hot-toast'
import { Bot, FileText, Zap, Shield } from 'lucide-react'

const TABS = [['diagnose', 'Diagnose Issue', Zap], ['config', 'Analyze Config', Shield], ['logs', 'Interpret Logs', FileText], ['chat', 'AI Chat', Bot]]
const DEVICE_TYPES = ['cisco', 'mikrotik', 'juniper', 'huawei', 'fortinet', 'paloalto', 'linux']
const LOG_TYPES = ['cisco', 'mikrotik', 'juniper', 'linux', 'windows', 'fortinet']

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
    e.preventDefault(); setDiagnosing(true); setDiagnoseResult(null)
    try { const { data } = await aiAPI.diagnose(diagnoseForm); setDiagnoseResult(data) }
    catch { toast.error('Diagnosis failed') }
    finally { setDiagnosing(false) }
  }

  const runAnalyzeConfig = async (e) => {
    e.preventDefault(); setAnalyzingConfig(true); setConfigResult(null)
    try { const { data } = await aiAPI.analyzeConfig({ config_text: configText, device_type: deviceType }); setConfigResult(data) }
    catch { toast.error('Config analysis failed') }
    finally { setAnalyzingConfig(false) }
  }

  const runInterpretLogs = async (e) => {
    e.preventDefault(); setAnalyzingLogs(true); setLogResult(null)
    try { const { data } = await aiAPI.interpretLogs({ log_lines: logText, device_type: logDeviceType }); setLogResult(data) }
    catch { toast.error('Log analysis failed') }
    finally { setAnalyzingLogs(false) }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title flex items-center gap-2"><Bot className="w-5 h-5 text-blue-400" />AI Diagnostics</h1>
        <p className="page-sub">Powered by Claude — network engineering AI assistant</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit flex-wrap" style={{ background: '#f9fafb' }}>
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

      {tab === 'diagnose' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form onSubmit={runDiagnose} className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Describe the Issue</h2>
            <div><label className="label">Issue Description *</label>
              <textarea className="input h-32 resize-none" required value={diagnoseForm.description}
                onChange={(e) => setDiagnoseForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Symptoms, error messages, affected users, recent changes…" /></div>
            <div><label className="label">Device Info</label>
              <input className="input" value={diagnoseForm.device_info}
                onChange={(e) => setDiagnoseForm((f) => ({ ...f, device_info: e.target.value }))}
                placeholder="e.g. Cisco ISR 4451, IP 10.0.1.1" /></div>
            <div><label className="label">Additional Context</label>
              <textarea className="input h-20 resize-none" value={diagnoseForm.additional_context}
                onChange={(e) => setDiagnoseForm((f) => ({ ...f, additional_context: e.target.value }))}
                placeholder="Network topology, recent changes…" /></div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={diagnosing}>
              <Zap className="w-4 h-4" />{diagnosing ? 'Analysing…' : 'Run AI Diagnosis'}
            </button>
          </form>
          {diagnoseResult && (
            <div className="card p-5 space-y-4 overflow-y-auto max-h-[600px]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-blue-400">Diagnosis Result</h2>
                <span className="badge bg-blue-500/20 text-blue-400 border border-blue-500/30">{Math.round((diagnoseResult.confidence_score ?? 0) * 100)}% confidence</span>
              </div>
              {diagnoseResult.error ? <p className="text-red-400 text-sm">{diagnoseResult.error}</p> : (
                <>
                  <div><p className="label">Diagnosis</p><p className="text-sm text-gray-700 leading-relaxed">{diagnoseResult.diagnosis}</p></div>
                  <div><p className="label">Root Cause</p><p className="text-sm text-gray-500">{diagnoseResult.root_cause}</p></div>
                  {diagnoseResult.fix_steps?.length > 0 && (
                    <div><p className="label">Fix Steps</p>
                      <ol className="space-y-1.5">{diagnoseResult.fix_steps.map((step, i) => (
                        <li key={i} className="text-sm text-gray-500 flex gap-2"><span className="text-gray-400 font-medium flex-shrink-0">{i + 1}.</span>{step}</li>
                      ))}</ol>
                    </div>
                  )}
                  {diagnoseResult.cli_commands?.length > 0 && (
                    <div><p className="label">CLI Commands</p>
                      {diagnoseResult.cli_commands.map((cmd, i) => <code key={i} className="cli-block mb-1">{cmd}</code>)}
                    </div>
                  )}
                  {diagnoseResult.escalate_to_human && (
                    <div className="rounded-xl p-3 text-sm text-red-400" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                      Human engineer review recommended
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form onSubmit={runAnalyzeConfig} className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Paste Device Configuration</h2>
            <div><label className="label">Device Type</label>
              <select className="input" value={deviceType} onChange={(e) => setDeviceType(e.target.value)}>
                {DEVICE_TYPES.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
              </select></div>
            <div><label className="label">Configuration *</label>
              <textarea className="input h-72 resize-none font-mono text-xs" required
                placeholder="Paste show running-config, /export, or similar…"
                value={configText} onChange={(e) => setConfigText(e.target.value)} /></div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={analyzingConfig}>
              <Shield className="w-4 h-4" />{analyzingConfig ? 'Analysing…' : 'Analyze Configuration'}
            </button>
          </form>
          {configResult && (
            <div className="card p-5 space-y-4 overflow-y-auto max-h-[600px]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Security Analysis</h2>
                {configResult.overall_security_score != null && (
                  <span className={`badge border ${configResult.overall_security_score >= 80 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : configResult.overall_security_score >= 50 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                    Score: {configResult.overall_security_score}/100
                  </span>
                )}
              </div>
              {configResult.summary && <p className="text-sm text-gray-500">{configResult.summary}</p>}
              {configResult.security_issues?.map((issue, i) => (
                <div key={i} className="p-3 rounded-xl"
                  style={{ borderLeft: `4px solid ${issue.severity === 'critical' ? '#ef4444' : issue.severity === 'high' ? '#f97316' : '#f59e0b'}`, background: '#f3f4f6' }}>
                  <p className="text-xs font-semibold uppercase text-gray-400">{issue.severity}</p>
                  <p className="text-sm font-medium text-gray-900">{issue.issue}</p>
                  <p className="text-xs text-gray-400 mt-1">{issue.recommendation}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <form onSubmit={runInterpretLogs} className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Paste Syslog / Log Output</h2>
            <div><label className="label">Device Type</label>
              <select className="input" value={logDeviceType} onChange={(e) => setLogDeviceType(e.target.value)}>
                {LOG_TYPES.map((v) => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
              </select></div>
            <div><label className="label">Log Output *</label>
              <textarea className="input h-72 resize-none font-mono text-xs" required
                placeholder="Paste syslog, dmesg, event viewer, or any logs…"
                value={logText} onChange={(e) => setLogText(e.target.value)} /></div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={analyzingLogs}>
              <FileText className="w-4 h-4" />{analyzingLogs ? 'Analysing…' : 'Interpret Logs'}
            </button>
          </form>
          {logResult && (
            <div className="card p-5 space-y-4 overflow-y-auto max-h-[600px]">
              <h2 className="text-sm font-semibold text-gray-900">Log Analysis</h2>
              {logResult.timeline_summary && <p className="text-sm text-gray-500">{logResult.timeline_summary}</p>}
              {logResult.requires_immediate_attention && (
                <div className="rounded-xl p-3 text-sm text-red-400 font-medium" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Requires immediate attention — {logResult.critical_events_count} critical event(s)
                </div>
              )}
              {logResult.error_patterns?.map((p, i) => (
                <div key={i} className="p-3 rounded-xl" style={{ background: '#f3f4f6' }}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">{p.pattern}</p>
                    <span className="badge bg-slate-700/50 text-gray-500 border border-slate-600/50">{p.occurrences}×</span>
                  </div>
                  <p className="text-xs text-gray-400">{p.interpretation}</p>
                  <p className="text-xs text-gray-400 mt-1 font-medium">→ {p.recommended_action}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'chat' && <ChatWindow />}
    </div>
  )
}
