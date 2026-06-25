import { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, ShieldAlert, Search, Users, TrendingUp,
  IndianRupee, AlertCircle, Clock, CheckCircle2, X, ChevronDown, ChevronUp, Activity
} from 'lucide-react';
import api from '../lib/api';
import './VerificationFlow.css';

const fmt = (val) => {
  if (val >= 10000000) return '₹' + (val / 10000000).toFixed(2) + ' Cr';
  if (val >= 100000)   return '₹' + (val / 100000).toFixed(2) + ' L';
  return '₹' + Number(val).toLocaleString('en-IN');
};

const STATUS_CONFIG = {
  'Fully Verified':      { color: '#10b981', bg: '#f0fdf4', border: '#86efac', short: 'FV' },
  'Partial Verified':    { color: '#3b82f6', bg: '#eff6ff', border: '#93c5fd', short: 'PV' },
  'Cash to be Verified': { color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d', short: 'CV' },
  'Not Verified':        { color: '#ef4444', bg: '#fef2f2', border: '#fca5a5', short: 'NV' },
  'Lockin Convert':      { color: '#8b5cf6', bg: '#f5f3ff', border: '#c4b5fd', short: 'LC' },
};

function HealthRing({ pct }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 75 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="28" cy="28" r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="28" y="32" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{pct}%</text>
    </svg>
  );
}

function MarketerCard({ m, statuses, rank }) {
  const [open, setOpen] = useState(false);
  const fv = m['Fully Verified'] || 0;
  const health = m.health;
  const healthColor = health >= 75 ? '#10b981' : health >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className={`vf2-card ${open ? 'vf2-card--open' : ''}`}>
      {/* Card Header */}
      <div className="vf2-card-head" onClick={() => setOpen(v => !v)}>
        <div className="vf2-card-rank">#{rank}</div>

        <div className="vf2-card-info">
          <div className="vf2-card-name">{m.name}</div>
          <div className="vf2-card-meta">
            <span>{m.total} investments</span>
            <span className="vf2-sep">·</span>
            <span>{fmt(m.principal)}</span>
            {m.regions?.length > 0 && (
              <>
                <span className="vf2-sep">·</span>
                <span style={{ color: '#6b7280' }}>{m.regions.join(', ')}</span>
              </>
            )}
          </div>
        </div>

        <div className="vf2-card-right">
          <HealthRing pct={health} />
          <div className="vf2-fv-badge" style={{ color: healthColor }}>
            <CheckCircle2 size={11} /> {fv} verified
          </div>
        </div>

        {/* Mini status bar */}
        <div className="vf2-mini-bar">
          {statuses.map(s => {
            const cnt = m[s] || 0;
            if (!cnt) return null;
            const pct = Math.round((cnt / m.total) * 100);
            const cfg = STATUS_CONFIG[s] || {};
            return (
              <div
                key={s}
                className="vf2-mini-seg"
                style={{ width: `${pct}%`, background: cfg.color }}
                title={`${s}: ${cnt} (${pct}%)`}
              />
            );
          })}
        </div>

        <div className="vf2-chevron">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="vf2-card-body">
          <div className="vf2-status-grid">
            {statuses.map(s => {
              const cnt = m[s] || 0;
              const pct = m.total > 0 ? Math.round((cnt / m.total) * 100) : 0;
              const cfg = STATUS_CONFIG[s] || { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', short: '?' };
              return (
                <div key={s} className="vf2-status-cell" style={{ background: cfg.bg, borderColor: cfg.border }}>
                  <div className="vf2-status-name" style={{ color: cfg.color }}>{s}</div>
                  <div className="vf2-status-count" style={{ color: cfg.color }}>{cnt}</div>
                  <div className="vf2-status-pct" style={{ color: cfg.color }}>{pct}%</div>
                  <div className="vf2-status-bar">
                    <div style={{ width: `${pct}%`, background: cfg.color, height: '100%', borderRadius: 2, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {m.portfolios?.length > 0 && (
            <div className="vf2-portfolios">
              {m.portfolios.map(p => (
                <span key={p} className="vf2-portfolio-tag">{p}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerificationFlow() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('total'); // total | health | principal | name

  useEffect(() => {
    api.get('/zoho_reports/verification-flow')
      .then(r => setData(r.data))
      .catch(e => { console.error(e); setError('Failed to load verification flow.'); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.marketers || [];

    // Search
    if (search.trim()) {
      list = list.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    }
    // Region
    if (region !== 'All') {
      list = list.filter(m => m.regions?.includes(region));
    }
    // Status: show only marketers who have at least one investment in that status
    if (statusFilter !== 'All') {
      list = list.filter(m => (m[statusFilter] || 0) > 0);
    }
    // Sort
    list = [...list].sort((a, b) => {
      if (sortBy === 'health')     return b.health - a.health;
      if (sortBy === 'principal')  return b.principal - a.principal;
      if (sortBy === 'name')       return a.name.localeCompare(b.name);
      return b.total - a.total;
    });

    return list;
  }, [data, search, region, statusFilter, sortBy]);

  if (loading) return (
    <div className="vf2-loading">
      <div className="vf2-spinner" />
      <p>Loading Verification Flow...</p>
    </div>
  );

  if (error) return (
    <div className="vf2-error"><ShieldAlert size={24} /> {error}</div>
  );

  if (!data) return null;

  const { global: g, statuses, status_totals } = data;

  return (
    <div className="vf2-root">
      {/* ── Header ── */}
      <div className="vf2-header">
        <div className="vf2-header-icon"><Activity size={22} /></div>
        <div>
          <h1 className="vf2-title">Verification Flow</h1>
          <p className="vf2-subtitle">Investment verification status by marketer</p>
        </div>
      </div>

      {/* ── Global Stats ── */}
      <div className="vf2-global">
        <div className="vf2-gstat">
          <Users size={16} className="vf2-gstat-icon" style={{ color: '#3b82f6' }} />
          <div>
            <div className="vf2-gstat-val">{g.total_marketers}</div>
            <div className="vf2-gstat-lbl">MARKETERS</div>
          </div>
        </div>
        <div className="vf2-gstat">
          <TrendingUp size={16} className="vf2-gstat-icon" style={{ color: '#10b981' }} />
          <div>
            <div className="vf2-gstat-val">{g.total_investments.toLocaleString()}</div>
            <div className="vf2-gstat-lbl">INVESTMENTS</div>
          </div>
        </div>
        <div className="vf2-gstat">
          <IndianRupee size={16} className="vf2-gstat-icon" style={{ color: '#f59e0b' }} />
          <div>
            <div className="vf2-gstat-val">{fmt(g.total_principal)}</div>
            <div className="vf2-gstat-lbl">TOTAL PRINCIPAL</div>
          </div>
        </div>
        <div className="vf2-gstat">
          <ShieldCheck size={16} className="vf2-gstat-icon" style={{ color: '#10b981' }} />
          <div>
            <div className="vf2-gstat-val">{status_totals?.['Fully Verified'] || 0}</div>
            <div className="vf2-gstat-lbl">FULLY VERIFIED</div>
          </div>
        </div>
        <div className="vf2-gstat">
          <AlertCircle size={16} className="vf2-gstat-icon" style={{ color: '#ef4444' }} />
          <div>
            <div className="vf2-gstat-val">{status_totals?.['Not Verified'] || 0}</div>
            <div className="vf2-gstat-lbl">NOT VERIFIED</div>
          </div>
        </div>
        <div className="vf2-gstat">
          <Clock size={16} className="vf2-gstat-icon" style={{ color: '#8b5cf6' }} />
          <div>
            <div className="vf2-gstat-val">{status_totals?.['Cash to be Verified'] || 0}</div>
            <div className="vf2-gstat-lbl">CASH TO VERIFY</div>
          </div>
        </div>
      </div>

      {/* ── Status Summary Bar ── */}
      <div className="vf2-status-strip">
        {statuses.map(s => {
          const cnt = status_totals?.[s] || 0;
          const pct = g.total_investments > 0 ? Math.round((cnt / g.total_investments) * 100) : 0;
          const cfg = STATUS_CONFIG[s] || {};
          return (
            <button
              key={s}
              className={`vf2-status-btn ${statusFilter === s ? 'vf2-status-btn--active' : ''}`}
              style={statusFilter === s ? { background: cfg.bg, borderColor: cfg.color, color: cfg.color } : {}}
              onClick={() => setStatusFilter(prev => prev === s ? 'All' : s)}
            >
              <span className="vf2-status-dot" style={{ background: cfg.color }} />
              <span className="vf2-status-btn-name">{s}</span>
              <span className="vf2-status-btn-cnt" style={{ color: cfg.color }}>{cnt}</span>
              <span className="vf2-status-btn-pct">({pct}%)</span>
            </button>
          );
        })}
        {statusFilter !== 'All' && (
          <button className="vf2-clear-filter" onClick={() => setStatusFilter('All')}>
            <X size={12} /> Clear filter
          </button>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="vf2-controls">
        <div className="vf2-search-wrap">
          <Search size={14} className="vf2-search-icon" />
          <input
            className="vf2-search"
            placeholder="Search marketer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="vf2-search-clear" onClick={() => setSearch('')}><X size={12} /></button>}
        </div>

        <select className="vf2-select" value={region} onChange={e => setRegion(e.target.value)}>
          <option value="All">All Regions</option>
          {(g.available_regions || []).map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select className="vf2-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="total">Sort: Investments ↓</option>
          <option value="principal">Sort: Principal ↓</option>
          <option value="health">Sort: Health % ↓</option>
          <option value="name">Sort: Name A–Z</option>
        </select>

        <div className="vf2-result-count">
          {filtered.length} of {(data.marketers || []).length} marketers
        </div>
      </div>

      {/* ── Marketer Cards ── */}
      <div className="vf2-cards">
        {filtered.length === 0 ? (
          <div className="vf2-empty">
            <ShieldAlert size={32} style={{ color: '#d1d5db' }} />
            <p>No marketers match your filters.</p>
          </div>
        ) : (
          filtered.map((m, i) => (
            <MarketerCard key={m.name} m={m} statuses={statuses} rank={i + 1} />
          ))
        )}
      </div>
    </div>
  );
}
