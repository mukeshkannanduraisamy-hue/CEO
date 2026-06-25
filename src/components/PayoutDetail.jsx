import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Wallet, Search, CheckCircle, Clock, TrendingUp,
  IndianRupee, ChevronDown, ChevronUp, X, Calendar, User, AlertCircle, Download
} from 'lucide-react';
import api from '../lib/api';
import { exportToExcel } from '../lib/export';
import './PayoutDetail.css';

const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN');
const today = () => new Date().toISOString().split('T')[0];

const tier = (pay) => {
  if (pay < 50000)  return 1;
  if (pay < 200000) return 2;
  return 3;
};

const TIER = [
  { label: 'Low',  range: '< ₹50K',     color: '#15803d', bg: '#f0fdf4', border: '#86efac', pill: '#dcfce7' },
  { label: 'Mid',  range: '₹50K–₹2L',   color: '#b45309', bg: '#fffbeb', border: '#fcd34d', pill: '#fef3c7' },
  { label: 'High', range: '> ₹2L',      color: '#be123c', bg: '#fff1f2', border: '#fda4af', pill: '#ffe4e6' },
];

const REGION_COLORS = {
  Salem: '#6366f1',
  Madurai: '#f59e0b',
  Others: '#10b981',
};

function getRegionColor(region) {
  return REGION_COLORS[region] || '#3b82f6';
}

function groupByHierarchy(rows) {
  const map = new Map();
  rows.forEach(r => {
    const port = r.portfolio || 'Unknown';
    const cp = r.channel_partner || 'Unknown';
    if (!map.has(port)) map.set(port, new Map());
    if (!map.get(port).has(cp)) map.get(port).set(cp, []);
    map.get(port).get(cp).push(r);
  });
  return map;
}

// ── Paid Modal ────────────────────────────────────────────────────────────────
function PaidModal({ row, regionColor, onConfirm, onClose }) {
  const remaining = row.payout_amount - row.paid_amount;
  const [amountPaid, setAmountPaid] = useState(remaining);
  const [paidDate, setPaidDate] = useState(today());
  const [paidBy,   setPaidBy]   = useState('');
  const ref = useRef();

  useEffect(() => { ref.current?.focus(); }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!paidBy.trim() || amountPaid <= 0) return;
    onConfirm({ amount_paid: Number(amountPaid), paidDate, paidBy: paidBy.trim() });
  };

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={e => e.stopPropagation()}>
        <div className="pm-header" style={{ '--pc': regionColor }}>
          <div className="pm-header-icon" style={{ background: regionColor + '18', color: regionColor }}>
            <CheckCircle size={20} />
          </div>
          <div className="pm-header-text">
            <div className="pm-header-title">Confirm Payment</div>
            <div className="pm-header-sub">{row.investor || row.channel_partner}</div>
          </div>
          <button className="pm-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="pm-amount-row" style={{ background: regionColor + '10', borderColor: regionColor + '25' }}>
          <div className="pm-amount-label">Remaining Balance</div>
          <div className="pm-amount-val" style={{ color: regionColor }}>{fmt(remaining)}</div>
        </div>

        <form className="pm-form" onSubmit={submit}>
          <label className="pm-field">
            <span className="pm-field-label">Amount to Pay (₹)</span>
            <input
              type="number"
              className="pm-input"
              value={amountPaid}
              max={remaining}
              onChange={e => setAmountPaid(e.target.value)}
              required
              style={{ '--fc': regionColor }}
            />
          </label>
          <label className="pm-field">
            <span className="pm-field-label"><Calendar size={13} /> Paid Date</span>
            <input
              type="date"
              className="pm-input"
              value={paidDate}
              onChange={e => setPaidDate(e.target.value)}
              required
              style={{ '--fc': regionColor }}
            />
          </label>
          <label className="pm-field">
            <span className="pm-field-label"><User size={13} /> Paid By</span>
            <input
              ref={ref}
              type="text"
              className="pm-input"
              value={paidBy}
              onChange={e => setPaidBy(e.target.value)}
              placeholder="Enter name of person who paid"
              required
              style={{ '--fc': regionColor }}
            />
          </label>

          <div className="pm-actions">
            <button type="button" className="pm-btn-cancel" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="pm-btn-confirm"
              disabled={!paidBy.trim() || amountPaid <= 0}
              style={{ background: regionColor }}
            >
              <CheckCircle size={14} /> Mark as Paid
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Channel Partner Row ───────────────────────────────────────────────────────
function ChannelPartnerRow({ cpName, investors, regionColor, onMarkPaid, expanded, onToggle, search }) {
  const totalInv = investors.reduce((s, i) => s + Number(i.current_amount), 0);
  const totalPayout = investors.reduce((s, i) => s + Number(i.payout_amount), 0);
  const totalPaid = investors.reduce((s, i) => s + Number(i.paid_amount), 0);
  
  const progress = totalPayout > 0 ? Math.round((totalPaid / totalPayout) * 100) : 0;
  let status = 'Pending';
  if (totalPaid > 0 && totalPaid < totalPayout) status = 'Partial';
  if (totalPaid >= totalPayout) status = 'Paid';

  return (
    <>
      <tr className="pb-tr pb-tr-cp" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <td className="pb-td pb-td--c" style={{ width: 40 }}>
          <span className="pb-chevron">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        </td>
        <td className="pb-td pb-td--name" style={{ fontWeight: 600 }}>{cpName} <span style={{fontSize:'0.75rem', color:'#64748b', marginLeft:6}}>({investors.length} investors)</span></td>
        <td className="pb-td pb-td--r">{fmt(totalInv)}</td>
        <td className="pb-td pb-td--r" style={{ color: regionColor }}>{fmt(totalPayout)}</td>
        <td className="pb-td pb-td--c">
          <div className="pb-cp-progress">
            <div className="pb-cp-progress-bar">
              <div style={{ width: `${progress}%`, background: status === 'Paid' ? '#16a34a' : regionColor }} />
            </div>
            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{fmt(totalPaid)}</span>
          </div>
        </td>
        <td className="pb-td pb-td--c">
          {status === 'Paid' ? <span className="pb-status pb-status--paid"><CheckCircle size={12} /> Paid</span>
           : status === 'Partial' ? <span className="pb-status pb-status--partial"><Clock size={12} /> Partial</span>
           : <span className="pb-status pb-status--pending"><Clock size={12} /> Pending</span>}
        </td>
        <td className="pb-td pb-td--c">
        </td>
      </tr>
      
      {(expanded || !!search) && investors.map((inv, idx) => {
        const isPaid = inv.status === 'Paid';
        const isPartial = inv.status === 'Partial';
        const t = TIER[tier(inv.payout_amount) - 1];

        return (
          <tr key={inv.id} className={`pb-tr pb-tr-child ${isPaid ? 'pb-tr--paid' : ''}`}>
            <td className="pb-td pb-td--c"></td>
            <td className="pb-td pb-td--name" style={{ paddingLeft: '2rem' }}>
              ↳ {inv.investor || '(Blank)'}
              {inv.investment_code && (
                <div style={{ fontSize: '0.7rem', color: '#64748b', paddingLeft: '1rem', marginTop: '2px' }}>
                  Code: {inv.investment_code}
                </div>
              )}
              {inv.paid_amount > 0 && (
                <div className="pb-paid-meta" style={{ paddingLeft: '1rem' }}>
                  <Calendar size={10} /> {inv.paid_date} <span className="pb-paid-sep">·</span> <User size={10} /> {inv.paid_by}
                </div>
              )}
            </td>
            <td className="pb-td pb-td--r">{fmt(inv.current_amount)}</td>
            <td className="pb-td pb-td--r">
              <div style={{ color: isPaid ? '#16a34a' : t.color }}>{fmt(inv.payout_amount)}</div>
              {inv.paid_amount > 0 && <div style={{ fontSize:'0.7rem', color:'#64748b' }}>Paid: {fmt(inv.paid_amount)}</div>}
            </td>
            <td className="pb-td pb-td--c">
              <span className="pb-tier" style={{ background: t.pill, color: t.color, border: `1px solid ${t.border}` }}>
                {t.label}
              </span>
            </td>
            <td className="pb-td pb-td--c">
              {isPaid ? <span className="pb-status pb-status--paid"><CheckCircle size={12} /> Paid</span>
               : isPartial ? <span className="pb-status pb-status--partial"><Clock size={12} /> Partial</span>
               : <span className="pb-status pb-status--pending"><Clock size={12} /> Pending</span>}
            </td>
            <td className="pb-td pb-td--c">
              {!isPaid && (
                <button
                  className="pb-btn pb-btn--pay"
                  style={{ '--bc': regionColor }}
                  onClick={(e) => { e.stopPropagation(); onMarkPaid(inv); }}
                >
                  <CheckCircle size={12} /> Pay
                </button>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ── Portfolio Block ───────────────────────────────────────────────────────────
function PortfolioBlock({ name, cpMap, regionColor, onMarkPaid, expanded, onToggle, search }) {
  const allInvestors = Array.from(cpMap.values()).flat();
  const totalInv  = allInvestors.reduce((s, m) => s + Number(m.current_amount), 0);
  const totalPay  = allInvestors.reduce((s, m) => s + Number(m.payout_amount), 0);
  const totalPaid = allInvestors.reduce((s, m) => s + Number(m.paid_amount), 0);
  
  const sumStatusPaid = allInvestors.filter(m => m.status === 'Paid').reduce((s, m) => s + Number(m.payout_amount), 0);
  const sumStatusPartial = allInvestors.filter(m => m.status === 'Partial').reduce((s, m) => s + Number(m.payout_amount), 0);
  const sumStatusPending = allInvestors.filter(m => m.status === 'Pending').reduce((s, m) => s + Number(m.payout_amount), 0);

  const allPaid   = totalPaid >= totalPay && totalPay > 0;
  const progress  = totalPay > 0 ? Math.round((totalPaid / totalPay) * 100) : 0;

  const [expandedCPs, setExpandedCPs] = useState({});
  const toggleCP = (cp) => setExpandedCPs(p => ({ ...p, [cp]: !p[cp] }));

  return (
    <div className={`pb-block ${allPaid ? 'pb-block--done' : ''}`}>
      <div className="pb-head" style={{ '--pc': regionColor }} onClick={onToggle}>
        <div className="pb-head-left">
          <div className="pb-icon" style={{ background: regionColor + '18', color: regionColor }}>💼</div>
          <div>
            <div className="pb-name">{name}</div>
            <div className="pb-meta">
              {cpMap.size} partners · {allInvestors.length} investors · {fmt(totalInv)} current · <span style={{ color: regionColor, fontWeight: 700 }}>{fmt(totalPay)} payout</span>
            </div>
          </div>
        </div>
        <div className="pb-head-right">
          <div style={{ display: 'flex', gap: '10px', fontSize: '0.7rem', color: '#64748b', marginRight: '1rem', alignItems: 'center' }}>
            <span style={{ color: '#16a34a' }}>Paid: {fmt(sumStatusPaid)}</span>
            <span style={{ color: '#3b82f6' }}>Partial: {fmt(sumStatusPartial)}</span>
            <span style={{ color: '#f59e0b' }}>Pending: {fmt(sumStatusPending)}</span>
          </div>
          <div className="pb-progress-wrap">
            <div className="pb-progress-bar">
              <div className="pb-progress-fill" style={{ width: progress + '%', background: allPaid ? '#16a34a' : regionColor }} />
            </div>
            <span className="pb-progress-label" style={{ color: allPaid ? '#16a34a' : regionColor }}>
              {progress}% paid
            </span>
          </div>
          {allPaid && <span className="pb-done-badge"><CheckCircle size={12} /> Completed</span>}
          <span className="pb-chevron">{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
        </div>
      </div>

      {(expanded || !!search) && (
        <div className="pb-table-wrap">
          <table className="pb-table">
            <thead>
              <tr>
                <th className="pb-th pb-th--c"></th>
                <th className="pb-th">Channel Partner / Investor Name</th>
                <th className="pb-th pb-th--r">Current (₹)</th>
                <th className="pb-th pb-th--r">2% Payout (₹)</th>
                <th className="pb-th pb-th--c">Progress / Tier</th>
                <th className="pb-th pb-th--c">Status</th>
                <th className="pb-th pb-th--c">Action</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(cpMap.entries()).map(([cp, invs]) => (
                <ChannelPartnerRow
                  key={cp}
                  cpName={cp}
                  investors={invs}
                  regionColor={regionColor}
                  onMarkPaid={onMarkPaid}
                  expanded={!!expandedCPs[cp]}
                  onToggle={() => toggleCP(cp)}
                  search={search}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChevronRight({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PayoutDetail() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('Salem');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); 
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    api.get('/payouts/')
      .then(r => {
        setData(r.data.data);
      })
      .catch(e => {
        console.error(e);
        setError("Failed to load payout data. The server might be temporarily unreachable.");
      })
      .finally(() => setLoading(false));
  };

  const handleMarkPaid = (row) => setModal({ row });

  const handleConfirmPaid = ({ amount_paid, paidDate, paidBy }) => {
    api.post(`/payouts/${modal.row.id}/pay`, { amount_paid, paid_date: paidDate, paid_by: paidBy })
      .then(r => {
        setModal(null);
        fetchData();
      })
      .catch(e => {
        console.error(e);
        alert("Failed to save payment.");
      });
  };

  const availableRegions = useMemo(() => {
    const s = new Set(data.map(d => d.region));
    return Array.from(s).filter(Boolean).sort().reverse();
  }, [data]);

  const activeTab = availableRegions.includes(tab) ? tab : (availableRegions[0] || 'Salem');

  const regionRows = useMemo(() => {
    if (!search.trim()) return data.filter(d => d.region === activeTab);
    const q = search.toLowerCase();
    return data.filter(d => d.region === activeTab && (
      (d.investor || '').toLowerCase().includes(q) || 
      (d.channel_partner || '').toLowerCase().includes(q) ||
      (d.portfolio || '').toLowerCase().includes(q) ||
      String(d.investment_id || '').toLowerCase().includes(q) ||
      String(d.investment_code || '').toLowerCase().includes(q)
    ));
  }, [data, activeTab, search]);

  const groups = useMemo(() => Array.from(groupByHierarchy(regionRows).entries()), [regionRows]);

  const totalInvestment = data.filter(d => d.region === activeTab).reduce((s, d) => s + Number(d.current_amount), 0);
  const totalPayout     = data.filter(d => d.region === activeTab).reduce((s, d) => s + Number(d.payout_amount), 0);
  const totalPaid       = data.filter(d => d.region === activeTab).reduce((s, d) => s + Number(d.paid_amount), 0);
  const totalPending    = totalPayout - totalPaid;
  const progressPercent = totalPayout > 0 ? Math.round((totalPaid / totalPayout) * 100) : 0;

  const sumStatusPaid = regionRows.filter(d => d.status === 'Paid').reduce((s, d) => s + Number(d.payout_amount), 0);
  const sumStatusPartial = regionRows.filter(d => d.status === 'Partial').reduce((s, d) => s + Number(d.payout_amount), 0);
  const sumStatusPending = regionRows.filter(d => d.status === 'Pending').reduce((s, d) => s + Number(d.payout_amount), 0);

  const toggleExpand = (name) => setExpanded(prev => ({ ...prev, [`${activeTab}__${name}`]: !prev[`${activeTab}__${name}`] }));
  const expandAll  = () => {
    const next = {};
    groups.forEach(([name]) => { next[`${activeTab}__${name}`] = true; });
    setExpanded(next);
  };
  const collapseAll = () => setExpanded({});

  const handleExportExcel = () => {
    if (!regionRows.length) {
      alert("No data to export for this view.");
      return;
    }
    const exportData = regionRows.map(r => ({
      Region: r.region,
      Portfolio: r.portfolio,
      'Channel Partner': r.channel_partner,
      Investor: r.investor,
      'Investment Code': r.investment_code,
      'Current Amount': r.current_amount,
      'Payout Amount': r.payout_amount,
      'Paid Amount': r.paid_amount,
      Status: r.status,
      'Paid Date': r.paid_date || '',
      'Paid By': r.paid_by || ''
    }));
    exportToExcel(exportData, `Payout_Report_${activeTab}`);
  };

  if (loading) {
    return <div className="pd-root" style={{ padding: 40, textAlign: 'center' }}>Loading Payout Data...</div>;
  }

  if (error) {
    return (
      <div className="pd-root" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#e11d48', marginBottom: '16px' }}>{error}</p>
        <button onClick={fetchData} style={{ padding: '8px 16px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="pd-root">
      <div className="pd-header">
        <div className="pd-header-left">
          <div className="pd-header-icon">
            <Wallet size={22} color="#e11d48" />
          </div>
          <div>
            <h2 className="pd-header-title">Payout Report</h2>
            <p className="pd-header-sub">Hierarchical Payout Flow · Partial Payments Supported</p>
          </div>
        </div>

        <div className="pd-legend">
          {TIER.map(t => (
            <div key={t.label} className="pd-legend-pill" style={{ background: t.pill, color: t.color, border: `1px solid ${t.border}` }}>
              <span className="pd-legend-dot" style={{ background: t.color }} />
              {t.label} <span style={{ opacity: 0.65, fontWeight: 400 }}>({t.range})</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pd-tabs-row">
        <div className="pd-tabs">
          {availableRegions.map(r => (
            <button
              key={r}
              className={`pd-tab ${activeTab === r ? 'pd-tab--active' : ''}`}
              style={activeTab === r ? { '--ta': getRegionColor(r) } : {}}
              onClick={() => { setTab(r); setSearch(''); }}
            >
              📍 {r}
            </button>
          ))}
        </div>

        <div className="pd-toolbar-right">
          <button className="pd-ctrl-btn" onClick={handleExportExcel} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a' }}>
            <Download size={14} /> Excel
          </button>
          <button className="pd-ctrl-btn" onClick={expandAll}>Expand All</button>
          <button className="pd-ctrl-btn" onClick={collapseAll}>Collapse All</button>
          <div className="pd-search-wrap">
            <Search size={13} className="pd-search-icon" />
            <input
              className="pd-search"
              placeholder="Search partner or investor…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="pd-strip">
        <div className="pd-strip-item">
          <IndianRupee size={13} style={{ color: getRegionColor(activeTab) }} />
          <span>Total Current</span>
          <strong style={{ color: getRegionColor(activeTab) }}>{fmt(totalInvestment)}</strong>
        </div>
        <div className="pd-strip-sep" />
        <div className="pd-strip-item">
          <TrendingUp size={13} color="#e11d48" />
          <span>Total Payout</span>
          <strong style={{ color: '#e11d48' }}>{fmt(totalPayout)}</strong>
        </div>
        <div className="pd-strip-sep" />
        <div className="pd-strip-item">
          <CheckCircle size={13} color="#16a34a" />
          <span>Total Paid</span>
          <strong style={{ color: '#16a34a' }}>{fmt(totalPaid)}</strong>
        </div>
        <div className="pd-strip-sep" />
        <div className="pd-strip-item">
          <Clock size={13} color="#f59e0b" />
          <span>Total Pending</span>
          <strong style={{ color: '#f59e0b' }}>{fmt(totalPending)}</strong>
        </div>
        <div className="pd-strip-sep" />
        <div className="pd-strip-item pd-strip-item--progress" style={{ flex: 1, flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="pd-overall-bar" style={{ marginBottom: 6 }}>
            <div className="pd-overall-fill" style={{ width: `${progressPercent}%`, background: getRegionColor(activeTab) }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <span style={{ color: getRegionColor(activeTab), fontWeight: 700 }}>{progressPercent}% Paid</span>
            <span style={{ color: '#64748b' }}>
              <span style={{ color: '#16a34a' }}>Paid: <b>{fmt(sumStatusPaid)}</b></span> · <span style={{ color: '#3b82f6' }}>Partial: <b>{fmt(sumStatusPartial)}</b></span> · <span style={{ color: '#f59e0b' }}>Pending: <b>{fmt(sumStatusPending)}</b></span>
            </span>
          </div>
        </div>
      </div>

      <div className="pd-groups">
        {groups.map(([name, cpMap]) => (
          <PortfolioBlock
            key={name}
            name={name}
            cpMap={cpMap}
            regionColor={getRegionColor(activeTab)}
            onMarkPaid={handleMarkPaid}
            expanded={!!expanded[`${activeTab}__${name}`]}
            onToggle={() => toggleExpand(name)}
            search={search}
          />
        ))}
        {groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
            No records found.
          </div>
        )}
      </div>

      {modal && (
        <PaidModal
          row={modal.row}
          regionColor={getRegionColor(activeTab)}
          onConfirm={handleConfirmPaid}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
