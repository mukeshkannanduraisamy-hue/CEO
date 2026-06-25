import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart2, Mail, Smartphone, CheckCircle2, AlertCircle,
  Loader, RefreshCw, Trash2, ChevronDown, ChevronUp,
  TrendingUp, Zap, Filter
} from 'lucide-react';
import './CampaignTracker.css';

const API   = import.meta.env.DEV ? 'http://localhost:8000' : '/api';
const WA    = import.meta.env.DEV ? 'http://localhost:3001' : '/wa';

const fmtTime = iso => {
  if (!iso) return '—';
  return new Date(iso + (iso.includes('Z') ? '' : 'Z')).toLocaleString([], {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
};

const fmtDuration = (start, end) => {
  if (!start) return '—';
  const ms = new Date(end || new Date()).getTime() - new Date(start + (start.includes('Z') ? '' : 'Z')).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
};

const ProgressRing = ({ pct, color }) => {
  const r = 28, circ = 2 * Math.PI * r;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68">
      <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle
        cx="34" cy="34" r={r} fill="none"
        stroke={color} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * circ} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: 'stroke-dasharray 0.5s ease' }}
      />
      <text x="34" y="38" textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>{pct}%</text>
    </svg>
  );
};

const ProgressBar = ({ value, max, color }) => (
  <div className="ct-track">
    <div className="ct-fill" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
  </div>
);

const statusColor = {
  running: '#6366f1', queued: '#f59e0b', completed: '#25d366',
  cancelled: '#64748b', failed: '#ef4444'
};

const CampaignRow = ({ c, onDelete }) => {
  const [open, setOpen] = useState(false);
  const total = c.total || 0;
  const sent = c.sent ?? c.success ?? 0;
  const failed = c.failed ?? 0;
  const pct = total > 0 ? Math.round((sent + failed) / total * 100) : 0;
  const col = statusColor[c.status] || '#64748b';
  const isRunning = c.status === 'running' || c.status === 'queued';
  const successRate = (sent + failed) > 0 ? Math.round(sent / (sent + failed) * 100) : 0;

  return (
    <div className={`ct-row ct-row--${c.status}`}>
      <div className="ct-row-main">
        {/* Type badge */}
        <div className="ct-type-badge" data-type={c.type}>
          {c.type === 'whatsapp' ? <Smartphone size={13} /> : <Mail size={13} />}
          {c.type === 'whatsapp' ? 'WhatsApp' : 'Email'}
        </div>

        {/* Status + preview */}
        <div className="ct-row-info">
          <div className="ct-row-preview">{c.preview || c.subject || '—'}</div>
          <div className="ct-row-meta">
            <span className="ct-status-dot" style={{ background: col }} />
            <span style={{ color: col, fontSize: 11, fontWeight: 700 }}>{c.status}</span>
            <span className="ct-sep">·</span>
            <span className="ct-meta-text">{fmtTime(c.started_at)}</span>
            {c.from_email && <><span className="ct-sep">·</span><span className="ct-meta-text">from {c.from_email}</span></>}
          </div>
        </div>

        {/* Progress ring */}
        <div className="ct-ring-wrap">
          <ProgressRing pct={pct} color={col} />
        </div>

        {/* Stats */}
        <div className="ct-mini-stats">
          <div className="ct-mini-stat"><span className="ct-mini-val" style={{ color: '#25d366' }}>{sent}</span><span className="ct-mini-lbl">sent</span></div>
          <div className="ct-mini-stat"><span className="ct-mini-val" style={{ color: '#ef4444' }}>{failed}</span><span className="ct-mini-lbl">failed</span></div>
          <div className="ct-mini-stat"><span className="ct-mini-val">{total}</span><span className="ct-mini-lbl">total</span></div>
        </div>

        {/* Actions */}
        <div className="ct-actions">
          <button className="ct-btn" onClick={() => setOpen(v => !v)}>
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {!isRunning && (
            <button className="ct-btn ct-btn--danger" onClick={() => onDelete(c.id, c.type)} title="Remove">
              <Trash2 size={13} />
            </button>
          )}
          {isRunning && <Loader size={13} className="ct-spin" style={{ color: col }} />}
        </div>
      </div>

      {/* Progress bar always visible */}
      <div style={{ padding: '0 16px 12px' }}>
        <ProgressBar value={sent + failed} max={total} color={col} />
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="ct-detail">
          <div className="ct-detail-grid">
            <div className="ct-detail-item"><span>Started</span><span>{fmtTime(c.started_at)}</span></div>
            <div className="ct-detail-item"><span>Finished</span><span>{c.finished_at ? fmtTime(c.finished_at) : '—'}</span></div>
            <div className="ct-detail-item"><span>Duration</span><span>{fmtDuration(c.started_at, c.finished_at)}</span></div>
            <div className="ct-detail-item"><span>Success Rate</span><span style={{ color: successRate > 80 ? '#25d366' : '#f59e0b' }}>{successRate}%</span></div>
            {c.eta_seconds > 0 && isRunning && <div className="ct-detail-item"><span>ETA</span><span>~{Math.ceil(c.eta_seconds / 60)}m</span></div>}
          </div>
          {c.errors?.length > 0 && (
            <div className="ct-errors">
              <div className="ct-errors-title"><AlertCircle size={11} /> Failed recipients ({c.errors.length})</div>
              <div className="ct-errors-list">
                {c.errors.slice(0, 8).map((e, i) => <span key={i} className="ct-error-tag">{e}</span>)}
                {c.errors.length > 8 && <span className="ct-error-tag ct-error-more">+{c.errors.length - 8} more</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function CampaignTracker() {
  const [campaigns, setCampaigns] = useState([]);
  const [waUp, setWaUp]           = useState(false);
  const [filter, setFilter]       = useState('all'); // all | email | whatsapp | running | completed
  const [isLoading, setIsLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchAll = useCallback(async () => {
    try {
      const emailP = fetch(`${API}/api/zoho/automail/status`).then(r => r.json()).catch(() => ({ campaigns: [] }));
      const waP    = fetch(`${WA}/campaigns`, { signal: AbortSignal.timeout(2000) })
                       .then(r => r.json())
                       .then(d => { setWaUp(true); return d; })
                       .catch(() => { setWaUp(false); return { campaigns: [] }; });

      const [emailD, waD] = await Promise.all([emailP, waP]);

      // Normalize: email uses `success` for sent count; WA uses `sent`
      const emailCamps = (emailD.campaigns || []).map(c => ({
        ...c,
        type: 'email',
        sent: c.sent ?? c.success ?? 0,
      }));
      const waCamps = (waD.campaigns || []).map(c => ({ ...c, type: 'whatsapp' }));

      const all = [...emailCamps, ...waCamps].sort((a, b) =>
        new Date(b.started_at || 0) - new Date(a.started_at || 0)
      );
      setCampaigns(all);
    } catch {
      // keep previous state
    } finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchAll();
    pollRef.current = setInterval(fetchAll, 3000);
    return () => clearInterval(pollRef.current);
  }, [fetchAll]);

  const handleDelete = async (id, type) => {
    if (type === 'whatsapp') {
      await fetch(`${WA}/campaigns/${id}`, { method: 'DELETE' }).catch(() => {});
    }
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  const filtered = campaigns.filter(c => {
    if (filter === 'all') return true;
    if (filter === 'running') return c.status === 'running' || c.status === 'queued';
    if (filter === 'completed') return c.status === 'completed';
    return c.type === filter;
  });

  // Stats
  const totalSent    = campaigns.reduce((s, c) => s + (c.sent ?? 0), 0);
  const totalFailed  = campaigns.reduce((s, c) => s + (c.failed ?? 0), 0);
  const running      = campaigns.filter(c => c.status === 'running' || c.status === 'queued').length;
  const emailCount   = campaigns.filter(c => c.type === 'email').length;
  const waCount      = campaigns.filter(c => c.type === 'whatsapp').length;
  const overallRate  = (totalSent + totalFailed) > 0 ? Math.round(totalSent / (totalSent + totalFailed) * 100) : 0;

  return (
    <div className="ct-root">
      {/* Header */}
      <div className="ct-header">
        <div className="ct-header-left">
          <div className="ct-header-icon"><BarChart2 size={20} /></div>
          <div>
            <h1 className="ct-title">Campaign Tracker</h1>
            <p className="ct-subtitle">Unified view of all Email &amp; WhatsApp bulk campaigns</p>
          </div>
        </div>
        <div className="ct-header-right">
          {!waUp && <span className="ct-warn-badge"><AlertCircle size={12} /> WA service offline</span>}
          <button className="ct-refresh-btn" onClick={fetchAll}><RefreshCw size={15} /></button>
        </div>
      </div>
      <div className="ct-scroll">

      {/* Stats Row */}
      <div className="ct-stats-row">
        <div className="ct-stat-card">
          <div className="ct-stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}><Zap size={18} /></div>
          <div><div className="ct-stat-val">{campaigns.length}</div><div className="ct-stat-lbl">Total Campaigns</div></div>
        </div>
        <div className="ct-stat-card">
          <div className="ct-stat-icon" style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366' }}><CheckCircle2 size={18} /></div>
          <div><div className="ct-stat-val">{totalSent.toLocaleString()}</div><div className="ct-stat-lbl">Messages Sent</div></div>
        </div>
        <div className="ct-stat-card">
          <div className="ct-stat-icon" style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}><AlertCircle size={18} /></div>
          <div><div className="ct-stat-val">{totalFailed.toLocaleString()}</div><div className="ct-stat-lbl">Failed</div></div>
        </div>
        <div className="ct-stat-card">
          <div className="ct-stat-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}><Loader size={18} className={running > 0 ? 'ct-spin' : ''} /></div>
          <div><div className="ct-stat-val" style={{ color: running > 0 ? '#818cf8' : undefined }}>{running}</div><div className="ct-stat-lbl">Running Now</div></div>
        </div>
        <div className="ct-stat-card">
          <div className="ct-stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}><TrendingUp size={18} /></div>
          <div><div className="ct-stat-val" style={{ color: overallRate > 90 ? '#25d366' : overallRate > 70 ? '#f59e0b' : '#f87171' }}>{overallRate}%</div><div className="ct-stat-lbl">Success Rate</div></div>
        </div>
        <div className="ct-stat-card">
          <div className="ct-stat-icon" style={{ background: 'rgba(37,99,235,0.12)', color: '#60a5fa' }}><Mail size={18} /></div>
          <div><div className="ct-stat-val">{emailCount}</div><div className="ct-stat-lbl">Email Campaigns</div></div>
        </div>
        <div className="ct-stat-card">
          <div className="ct-stat-icon" style={{ background: 'rgba(37,211,102,0.08)', color: '#25d366' }}><Smartphone size={18} /></div>
          <div><div className="ct-stat-val">{waCount}</div><div className="ct-stat-lbl">WhatsApp Campaigns</div></div>
        </div>
      </div>

        {/* Filter Bar */}
        <div className="ct-filters">
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          {[['all', 'All'], ['running', 'Running'], ['completed', 'Completed'], ['email', 'Email Only'], ['whatsapp', 'WhatsApp Only']].map(([v, l]) => (
            <button key={v} className={`ct-filter-btn ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</button>
          ))}
          <span className="ct-count">{filtered.length} campaigns</span>
        </div>

        {/* Campaign List */}
        {isLoading ? (
          <div className="ct-loading"><Loader size={28} className="ct-spin" /><span>Loading campaigns…</span></div>
        ) : filtered.length === 0 ? (
          <div className="ct-empty">
            <BarChart2 size={48} opacity={0.15} />
            <p>No campaigns found</p>
            <span>Campaigns appear here as soon as you dispatch from AutoMail or WhatsApp</span>
          </div>
        ) : (
          <div className="ct-list">
            {filtered.map(c => <CampaignRow key={c.id} c={c} onDelete={handleDelete} />)}
          </div>
        )}
      </div>
    </div>
  );
}
