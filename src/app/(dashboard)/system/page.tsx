'use client'
import { useState } from 'react'
import { Terminal, RefreshCw, GitBranch, Server, Clock, CheckCircle2, AlertCircle, Code } from 'lucide-react'
import pkg from '../../../../package.json'

export default function SystemPage() {
  const [log, setLog] = useState<string[]>([])
  const [pulling, setPulling] = useState(false)
  const [pullStatus, setPullStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const buildInfo = {
    appVersion:  pkg.version,
    nextVersion: pkg.dependencies['next'],
    nodeVersion: typeof process !== 'undefined' ? process.version : 'N/A',
    buildDate:   new Date().toLocaleString('en-IN'),
  }

  async function handlePullUpdate() {
    setPulling(true)
    setPullStatus('idle')
    setLog(['⟳ Initiating git pull…'])

    try {
      const res = await fetch('/api/system/update', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        setPullStatus('success')
        setLog(prev => [
          ...prev,
          '─'.repeat(40),
          ...(data.output as string).split('\n'),
          '─'.repeat(40),
          '✓ Update complete. Restart the server process to apply changes.',
        ])
      } else {
        setPullStatus('error')
        setLog(prev => [
          ...prev,
          '✗ Error: ' + (data.error as string),
        ])
      }
    } catch (e) {
      setPullStatus('error')
      setLog(prev => [...prev, '✗ Network error: ' + String(e)])
    } finally {
      setPulling(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">System</h1>
          <p className="page-subtitle">Application info and update management</p>
        </div>
      </div>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { icon: Code,      label: 'App Version',  value: `v${buildInfo.appVersion}` },
          { icon: Server,    label: 'Next.js',       value: buildInfo.nextVersion },
          { icon: GitBranch, label: 'Stack',         value: 'Next.js + Supabase' },
          { icon: Clock,     label: 'Server Time',   value: buildInfo.buildDate },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Outfit', color: 'var(--text-primary)' }}>{value}</div>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={18} color="var(--accent)" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Update panel */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>Pull Latest Update</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Runs <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>git pull origin main</code> on the server.
              Restart the process after a successful pull to apply code changes.
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handlePullUpdate}
            disabled={pulling}
            style={{ minWidth: 140 }}
          >
            {pulling
              ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Pulling…</>
              : <><RefreshCw size={14} /> Pull Update</>
            }
          </button>
        </div>

        {pullStatus === 'success' && (
          <div className="alert alert-success" style={{ marginBottom: 12 }}>
            <CheckCircle2 size={14} /> Update pulled successfully.
          </div>
        )}
        {pullStatus === 'error' && (
          <div className="alert alert-error" style={{ marginBottom: 12 }}>
            <AlertCircle size={14} /> Update failed. See log below.
          </div>
        )}

        {log.length > 0 && (
          <div style={{
            background: '#0a0c14',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px',
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#a0aec0',
            maxHeight: 320,
            overflowY: 'auto',
            lineHeight: 1.7,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--accent)' }}>
              <Terminal size={13} /> update log
            </div>
            {log.map((line, i) => (
              <div key={i} style={{ color: line.startsWith('✓') ? 'var(--green)' : line.startsWith('✗') ? 'var(--red)' : '#a0aec0' }}>
                {line || ' '}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Privacy notice */}
      <div className="alert alert-info" style={{ marginTop: 20 }}>
        <Server size={14} />
        <div>
          <strong>Developer access is restricted.</strong> This account cannot view student records, fee transactions, or any school financial data.
          This page exists solely for app maintenance and update management.
        </div>
      </div>
    </div>
  )
}
