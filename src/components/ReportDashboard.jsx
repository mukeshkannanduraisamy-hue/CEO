import { useEffect, useState, useMemo } from 'react';
import './ReportDashboard.css';
import { useReportStore } from '../stores/useReportStore';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  BarChart, Bar
} from 'recharts';
import {
  Activity, Users, AlertTriangle, Calendar, TrendingUp,
  Download, PieChart as PieIcon, BarChart3, ChevronRight,
  Database, MapPin, User, Phone, Tag, ChevronDown, ChevronUp,
  FileText, Search, ArrowUp, ArrowDown, ArrowUpDown, Clock,
  Award, Layers, Hash, Flame, Star, Info, X
} from 'lucide-react';
import { clsx } from 'clsx';
import ReportFilters from './ReportFilters';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { exportToCSV } from '../lib/export';
import api from '../lib/api';
import { toast } from 'sonner';

// ─── Config ───────────────────────────────────────────────────
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
const TOOLTIP = {
  contentStyle: { backgroundColor: '#fff', border: '1px solid #DDE1E7', borderRadius: '8px', fontSize: '11px', color: '#0F172A', boxShadow: '0 4px 16px rgba(0,0,0,.08)' },
  labelStyle: { color: '#64748B', fontWeight: 600 },
};
const SEV = {
  low: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', score: 1 },
  neutral: { cls: 'bg-blue-50   text-blue-600   border-blue-200', score: 2 },
  moderate: { cls: 'bg-amber-50  text-amber-700  border-amber-200', score: 3 },
  high: { cls: 'bg-orange-50 text-orange-700 border-orange-200', score: 4 },
  critical: { cls: 'bg-red-50    text-red-700    border-red-200', score: 5 },
};
const DAY = ['', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SLOTS = [
  { label: 'Night\n0–5', hours: new Set([0, 1, 2, 3, 4, 5]) },
  { label: 'Morning\n6–11', hours: new Set([6, 7, 8, 9, 10, 11]) },
  { label: 'Afternoon\n12–17', hours: new Set([12, 13, 14, 15, 16, 17]) },
  { label: 'Evening\n18–23', hours: new Set([18, 19, 20, 21, 22, 23]) },
];

// ─── Utility components ───────────────────────────────────────
const SortBtn = ({ col, sk, dir }) =>
  sk !== col ? <ArrowUpDown size={10} className="opacity-25 ml-1 inline-block" />
    : dir === 'asc' ? <ArrowUp size={10} className="text-accent-primary ml-1 inline-block" />
      : <ArrowDown size={10} className="text-accent-primary ml-1 inline-block" />;

const Bar100 = ({ pct, color = '#3b82f6' }) => (
  <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden mt-1.5">
    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
  </div>
);

const Badge = ({ children, cls }) => (
  <span className={clsx('px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border', cls)}>{children}</span>
);

const SecHead = ({ icon: Icon, title, sub, right }) => (
  <div className="px-5 py-4 border-b border-border flex items-center justify-between">
    <div className="flex items-center gap-2.5">
      <div className="p-1.5 bg-accent-primary/10 rounded-lg"><Icon size={14} className="text-accent-primary" /></div>
      <div>
        <p className="text-[13px] font-bold text-text-primary">{title}</p>
        {sub && <p className="text-[11px] text-text-muted">{sub}</p>}
      </div>
    </div>
    {right}
  </div>
);

// ─── Expandable log row ───────────────────────────────────────
const LogRow = ({ log, idx }) => {
  const [open, setOpen] = useState(false);
  const sev = SEV[log.severity] || { cls: 'bg-bg-elevated text-text-muted border-border' };
  const meta = useMemo(() => {
    try { return typeof log.custom_fields_json === 'string' ? JSON.parse(log.custom_fields_json || '{}') : (log.custom_fields_json || {}); }
    catch { return {}; }
  }, [log.custom_fields_json]);
  const extras = Object.keys(meta).filter(k => !['Document URL', 'Document Name', 'Attached Document'].includes(k));

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className={clsx(
          'group cursor-pointer border-b border-border/60 transition-colors hover:bg-accent-primary/[0.03]',
          idx % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-base/20',
          open && 'bg-blue-50/40'
        )}
      >
        <td className="pl-4 pr-2 py-3 w-28 shrink-0">
          <p className="text-[11px] font-medium text-text-secondary whitespace-nowrap">{format(new Date(log.date_of_call), 'dd/MM/yyyy')}</p>
          <p className="text-[10px] text-text-muted/60 mt-0.5">{format(new Date(log.date_of_call), 'hh:mm a')}</p>
        </td>
        <td className="px-2 py-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-[10px] font-bold text-accent-primary shrink-0">
              {log.agent_name?.slice(0, 2).toUpperCase()}
            </div>
            <span className="text-[12px] font-semibold text-text-primary">{log.agent_name}</span>
          </div>
        </td>
        <td className="px-2 py-3">
          <div className="flex items-center gap-1.5">
            <User size={11} className="text-text-muted/40 shrink-0" />
            <span className="text-[12px] font-medium text-text-primary truncate max-w-[130px]">{log.investor_name}</span>
          </div>
        </td>
        <td className="px-2 py-3 max-w-[120px]">
          <span className="text-[11px] text-text-secondary truncate block">{log.purpose || '—'}</span>
        </td>
        <td className="px-2 py-3">
          <span className="text-[11px] text-text-secondary">{log.nature || '—'}</span>
        </td>
        <td className="px-2 py-3">
          {log.severity ? <Badge cls={sev.cls}>{log.severity}</Badge> : <span className="text-text-muted/40">—</span>}
        </td>
        <td className="px-2 py-3">
          <span className="text-[11px] text-text-muted">{log.region || '—'}</span>
        </td>
        <td className="px-2 py-3 max-w-[180px]">
          <p className="text-[11px] text-text-muted truncate leading-snug">{log.notes || <span className="italic opacity-40">No notes</span>}</p>
        </td>
        <td className="px-2 pr-4 py-3 w-6">
          {open ? <ChevronUp size={13} className="text-text-muted/60" /> : <ChevronDown size={13} className="text-text-muted/30 group-hover:text-text-muted/60" />}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={9} className="p-0 border-b border-border">
            <div className="px-5 py-4 bg-blue-50/30 grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* Notes */}
              <div className="md:col-span-2">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Full Call Notes</p>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  {log.notes || <span className="italic text-text-muted/40">No notes recorded.</span>}
                </p>
              </div>

              {/* Meta + doc */}
              <div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">Call Details</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[12px]">
                    <span className="text-text-muted">Log ID</span>
                    <span className="font-mono font-semibold text-text-primary">#{log.log_id}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-text-muted">Agent</span>
                    <span className="font-semibold text-text-primary">{log.agent_name}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-text-muted">Region</span>
                    <span className="font-semibold text-text-primary">{log.region || '—'}</span>
                  </div>
                  {extras.map(k => (
                    <div key={k} className="flex justify-between text-[12px]">
                      <span className="text-text-muted">{k}</span>
                      <span className="font-semibold text-text-primary truncate max-w-[120px]" title={meta[k]}>{meta[k]}</span>
                    </div>
                  ))}
                </div>
                {meta['Document URL'] && (
                  <a
                    href={meta['Document URL']} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-accent-primary text-white rounded-lg text-[11px] font-semibold hover:bg-blue-600 transition-colors"
                  >
                    <FileText size={11} /> {meta['Document Name'] || 'View Document'}
                  </a>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ─── Main ─────────────────────────────────────────────────────
export default function ReportDashboard() {
  const {
    summary, demographic, trend, distribution, performance, heatmap,
    tableData, totalRows, page, limit,
    fetchAllData, fetchTable, filters
  } = useReportStore();

  /* UI state */
  const [logSearch, setLogSearch] = useState('');
  const [logSort, setLogSort] = useState({ key: 'date_of_call', dir: 'desc' });
  const [agentSort, setAgentSort] = useState({ key: 'total', dir: 'desc' });
  const [activeTab, setActiveTab] = useState('purpose');

  const [modalDate, setModalDate] = useState(null);
  const [modalLogs, setModalLogs] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const openDateModal = async (dateStr) => {
    setModalDate(dateStr);
    setModalLoading(true);
    try {
      const res = await api.get('/reports/table', { params: { ...filters, startDate: dateStr, endDate: dateStr + ' 23:59:59', limit: 500, page: 1 } });
      setModalLogs(res.data?.data?.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setModalLoading(false);
    }
  };

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  /* ── Derived: agent leaderboard ── */
  const agentRows = useMemo(() => {
    const m = {};
    (performance || []).forEach(r => {
      if (!m[r.agent]) m[r.agent] = { agent: r.agent, total: 0, top: '', topN: 0, cats: {} };
      m[r.agent].total += +r.count;
      m[r.agent].cats[r.category] = (+m[r.agent].cats[r.category] || 0) + +r.count;
      if (+r.count > m[r.agent].topN) { m[r.agent].top = r.category; m[r.agent].topN = +r.count; }
    });
    const arr = Object.values(m);
    const max = Math.max(...arr.map(a => a.total), 1);
    return arr
      .map(a => ({ ...a, pct: Math.round(a.total / max * 100) }))
      .sort((a, b) => agentSort.dir === 'asc'
        ? (agentSort.key === 'total' ? a.total - b.total : a.agent.localeCompare(b.agent))
        : (agentSort.key === 'total' ? b.total - a.total : b.agent.localeCompare(a.agent))
      );
  }, [performance, agentSort]);

  /* ── Derived: distributions with % ── */
  const mkDist = (arr = []) => {
    const t = arr.reduce((s, d) => s + +d.value, 0) || 1;
    return arr.map(d => ({ ...d, pct: Math.round(+d.value / t * 100) })).sort((a, b) => +b.value - +a.value);
  };
  const purposeRows = useMemo(() => mkDist(distribution?.purposeDist), [distribution]);
  const natureRows = useMemo(() => mkDist(distribution?.natureDist), [distribution]);

  /* ── Derived: Standard Monthly Calendar Heatmap ── */
  const [calMonth, setCalMonth] = useState(() => new Date());
  
  useEffect(() => {
    if (trend?.length) {
      const maxDate = new Date(Math.max(...trend.map(t => new Date(t.day))));
      setCalMonth(new Date(maxDate.getFullYear(), maxDate.getMonth(), 1));
    }
  }, [trend]);

  const { max: calMax, days: calDays } = useMemo(() => {
    let max = 1;
    const map = {};
    if (trend?.length) {
      max = Math.max(...trend.map(t => t.count), 1);
      trend.forEach(t => map[t.day] = t.count);
    }
    
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dStr = format(new Date(year, month, i), 'yyyy-MM-dd');
      days.push({
        date: i,
        dateStr: dStr,
        count: map[dStr] || 0
      });
    }
    return { max, days };
  }, [trend, calMonth]);

  const prevMonth = () => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const getCellDesign = (val, max) => {
    if (!val) return { bg: '#f8fafc', color: '#94a3b8', shadow: 'none', border: '1px solid #e2e8f0' };
    const p = val / max;
    if (p > .75) return { bg: 'linear-gradient(135deg, #a78bfa, #6366f1)', color: '#ffffff', shadow: '0 4px 14px rgba(99,102,241,0.3)', border: 'none' }; // Peak: Purple to Indigo
    if (p > .5) return { bg: 'linear-gradient(135deg, #fca5a5, #ef4444)', color: '#ffffff', shadow: '0 4px 14px rgba(239,68,68,0.3)', border: 'none' }; // High: Red to Rose
    if (p > .25) return { bg: 'linear-gradient(135deg, #fde047, #f59e0b)', color: '#ffffff', shadow: '0 4px 14px rgba(245,158,11,0.3)', border: 'none' }; // Medium: Yellow to Amber
    return { bg: 'linear-gradient(135deg, #6ee7b7, #10b981)', color: '#ffffff', shadow: '0 4px 14px rgba(16,185,129,0.3)', border: 'none' }; // Low: Mint to Emerald
  };

  /* ── Derived: sorted & filtered call log ── */
  const sortedLog = useMemo(() => {
    let rows = [...tableData];
    if (logSearch) {
      const q = logSearch.toLowerCase();
      rows = rows.filter(r =>
        r.investor_name?.toLowerCase().includes(q) ||
        r.agent_name?.toLowerCase().includes(q) ||
        r.purpose?.toLowerCase().includes(q) ||
        r.nature?.toLowerCase().includes(q) ||
        r.region?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q)
      );
    }
    const d = logSort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const av = a[logSort.key] ?? '', bv = b[logSort.key] ?? '';
      if (logSort.key === 'date_of_call') return d * (new Date(av) - new Date(bv));
      return d * String(av).localeCompare(String(bv));
    });
  }, [tableData, logSearch, logSort]);

  const toggleSort = key => setLogSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  /* ── Export ── */
  const handleExport = async () => {
    try {
      toast.info('Preparing export…');
      const res = await api.get('/reports/table', { params: { ...filters, page: 1, limit: 100000 } });
      const raw = res.data.data?.data;
      if (!raw?.length) { toast.error('No data to export.'); return; }
      exportToCSV(raw.map(log => {
        const meta = (() => { try { return typeof log.custom_fields_json === 'string' ? JSON.parse(log.custom_fields_json || '{}') : (log.custom_fields_json || {}); } catch { return {}; } })();
        return { Date: format(new Date(log.date_of_call), 'dd/MM/yyyy hh:mm a'), Agent: log.agent_name, Client: log.investor_name, Purpose: log.purpose, Nature: log.nature, Severity: log.severity, Region: log.region || '', Notes: log.notes, ...meta };
      }), 'call_report');
      toast.success('Exported.');
    } catch { toast.error('Export failed.'); }
  };

  /* ─── RENDER ─────────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-5 min-h-full pb-10 text-text-primary select-none">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Call Report Hub</h1>
          <p className="text-[12px] text-text-muted mt-0.5">Telecalling intelligence — agents · clients · regions · severity · time</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border rounded-lg text-[12px] font-semibold text-text-secondary hover:text-text-primary shadow-sm transition-all">
            <Download size={13} /> Export CSV
          </button>
          <ReportFilters />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Calls', value: summary?.totalCalls || 0, sub: 'All call logs', icon: Phone, accent: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Active Agents', value: summary?.activeAgents || 0, sub: 'Agents with calls', icon: Users, accent: 'text-emerald-500', bg: 'bg-emerald-50' },
          { label: 'Avg Severity', value: Number(summary?.avgSeverity || 0).toFixed(1), sub: 'Scale 1–5', icon: AlertTriangle, accent: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Calls Today', value: summary?.callsToday || 0, sub: 'Logged since midnight', icon: Calendar, accent: 'text-purple-500', bg: 'bg-purple-50' },
        ].map(c => (
          <div key={c.label} className="bg-bg-surface border border-border rounded-xl p-5 shadow-sm hover:border-accent-primary/20 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className={clsx('p-2 rounded-lg', c.bg)}><c.icon size={15} className={c.accent} /></div>
            </div>
            <p className="text-2xl font-bold text-text-primary leading-none">{c.value}</p>
            <p className="text-[12px] font-semibold text-text-muted mt-1">{c.label}</p>
            <p className="text-[10px] text-text-muted/60 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Trend + Region ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <SecHead icon={TrendingUp} title="Daily Call Volume" sub="Number of calls logged per day" />
          <div className="p-5 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip {...TOOLTIP} />
                <Area type="monotone" dataKey="count" name="Calls" stroke="#3b82f6" strokeWidth={2} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <SecHead icon={MapPin} title="Calls by Region" />
          <div className="p-4 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={demographic?.regionalData || []} innerRadius={55} outerRadius={78} paddingAngle={4} dataKey="value" nameKey="name">
                  {(demographic?.regionalData || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />)}
                </Pie>
                <Tooltip {...TOOLTIP} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '10px', color: '#64748b', paddingTop: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Agent Leaderboard + Distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Agent leaderboard */}
        <div className="bg-bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <SecHead icon={Award} title="Agent Leaderboard" sub="Total calls per agent"
            right={
              <div className="flex gap-1 text-[10px]">
                {[['total', 'Calls'], ['agent', 'Name']].map(([k, l]) => (
                  <button key={k} onClick={() => setAgentSort(s => ({ key: k, dir: s.key === k && s.dir === 'desc' ? 'asc' : 'desc' }))}
                    className={clsx('px-2.5 py-1 rounded-md font-semibold transition-all',
                      agentSort.key === k ? 'bg-accent-primary/10 text-accent-primary' : 'text-text-muted hover:bg-bg-elevated')}>
                    {l} {agentSort.key === k && (agentSort.dir === 'asc' ? '↑' : '↓')}
                  </button>
                ))}
              </div>
            }
          />
          <div className="divide-y divide-border">
            {agentRows.length === 0 && <p className="py-10 text-center text-[12px] text-text-muted/40">No agent data.</p>}
            {agentRows.map((a, i) => (
              <div key={a.agent} className="px-5 py-4 hover:bg-bg-base/40 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold shrink-0',
                    i === 0 ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' :
                      i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-bg-elevated text-text-muted')}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-bold text-text-primary capitalize">{a.agent}</span>
                      <span className="text-[13px] font-bold text-accent-primary">{a.total}</span>
                    </div>
                    <p className="text-[11px] text-text-muted truncate">Top: {a.top || '—'}</p>
                  </div>
                </div>
                <Bar100 pct={a.pct} />
                {/* Category breakdown mini-pills */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {Object.entries(a.cats).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([cat, cnt]) => (
                    <span key={cat} className="px-2 py-0.5 bg-bg-elevated border border-border rounded text-[10px] font-medium text-text-muted">
                      {cat} <span className="text-accent-primary font-bold">{cnt}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Distribution tabs */}
        <div className="bg-bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 pt-4 pb-0 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-accent-primary/10 rounded-lg"><Layers size={14} className="text-accent-primary" /></div>
              <p className="text-[13px] font-bold text-text-primary">Call Breakdown</p>
            </div>
            <div className="flex gap-1 bg-bg-base rounded-lg p-1 mb-4">
              {[['purpose', 'By Purpose'], ['nature', 'By Nature']].map(([k, l]) => (
                <button key={k} onClick={() => setActiveTab(k)}
                  className={clsx('flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all',
                    activeTab === k ? 'bg-bg-surface text-text-primary shadow-sm border border-border' : 'text-text-muted hover:text-text-primary')}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-border overflow-y-auto" style={{ maxHeight: 320 }}>
            {(activeTab === 'purpose' ? purposeRows : natureRows).map((row, i) => (
              <div key={row.name} className="px-5 py-3.5 hover:bg-bg-base/40 transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[12px] font-semibold text-text-primary truncate">{row.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[13px] font-bold text-text-primary">{row.value}</span>
                    <span className="text-[10px] font-semibold text-text-muted w-9 text-right">{row.pct}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: COLORS[i % COLORS.length], transition: 'width .5s' }} />
                </div>
              </div>
            ))}
            {!(activeTab === 'purpose' ? purposeRows : natureRows).length &&
              <p className="py-10 text-center text-[12px] text-text-muted/40">No data.</p>}
          </div>
        </div>
      </div>

      {/* ── Daily Activity Calendar ── */}
      <div className="bg-bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <SecHead icon={Calendar} title="Daily Call Calendar" sub="Call volume across the month"
          right={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-[10px] text-text-muted mr-4 hidden md:flex">
                {[
                  ['linear-gradient(135deg, #6ee7b7, #10b981)', 'Low'], 
                  ['linear-gradient(135deg, #fde047, #f59e0b)', 'Mid'], 
                  ['linear-gradient(135deg, #fca5a5, #ef4444)', 'High'],
                  ['linear-gradient(135deg, #a78bfa, #6366f1)', 'Peak']
                ].map(([bg, l]) => (
                  <div key={l} className="flex items-center gap-1.5 ml-2"><div className="w-3 h-3 rounded-sm" style={{ background: bg }} />{l}</div>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-bg-base border border-border p-1 rounded-lg">
                <button onClick={prevMonth} className="p-1 hover:bg-bg-elevated rounded text-text-muted hover:text-text-primary transition-colors"><ChevronRight size={14} className="rotate-180" /></button>
                <span className="text-[12px] font-bold text-text-primary min-w-[100px] text-center">
                  {format(calMonth, 'MMMM yyyy')}
                </span>
                <button onClick={nextMonth} className="p-1 hover:bg-bg-elevated rounded text-text-muted hover:text-text-primary transition-colors"><ChevronRight size={14} /></button>
              </div>
            </div>
          }
        />
        <div className="p-5">
          <div className="grid grid-cols-7 gap-2">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
               <div key={d} className="text-center text-[10px] font-bold text-text-muted uppercase tracking-wider mb-2">
                 {d}
               </div>
            ))}
            {calDays.map((d, i) => {
               if (!d) {
                 return <div key={`empty-${i}`} className="rounded-xl bg-bg-base/30 border border-border/30" style={{ height: '85px' }} />;
               }
               const design = getCellDesign(d.count, calMax);
               return (
                 <div key={i} title={`${d.dateStr}: ${d.count} calls`}
                      onClick={() => d.count > 0 && openDateModal(d.dateStr)}
                      className="relative rounded-xl flex flex-col items-center justify-center p-2 transition-all cursor-pointer hover:scale-[1.02]"
                      style={{ 
                        height: '85px', 
                        background: design.bg, 
                        color: design.color, 
                        boxShadow: design.shadow, 
                        border: design.border 
                      }}>
                    <span className="absolute text-[11px] font-bold" style={{ opacity: d.count ? 0.9 : 0.5, top: '6px', left: '8px' }}>
                      {d.date}
                    </span>
                    {d.count > 0 && (
                      <div className="mt-2 text-[15px] font-extrabold flex items-center gap-1 drop-shadow-sm">
                        <Phone size={13} style={{ opacity: 0.9 }} /> {d.count}
                      </div>
                    )}
                 </div>
               );
            })}
          </div>
        </div>
      </div>

      {/* ── Agent × Purpose Bar Chart ── */}
      {agentRows.length > 0 && (
        <div className="bg-bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
          <SecHead icon={BarChart3} title="Agent Call Volume" sub="Calls per agent — hover for details" />
          <div className="p-5 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentRows.map(a => ({ name: a.agent, calls: a.total }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EDF3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={6} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <Tooltip cursor={{ fill: 'rgba(59,130,246,.05)' }} {...TOOLTIP} />
                <Bar dataKey="calls" name="Calls" fill="#3b82f6" radius={[5, 5, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Full Call Log ── */}
      <div className="bg-bg-surface border border-border rounded-xl shadow-sm overflow-hidden">
        <SecHead icon={Database} title="Call Log"
          sub={`${totalRows} total records — click any row to expand details`}
          right={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                <input
                  value={logSearch} onChange={e => setLogSearch(e.target.value)}
                  placeholder="Search log…"
                  className="pl-8 pr-3 py-1.5 bg-bg-base border border-border rounded-lg text-[12px] text-text-primary placeholder-text-muted/50 focus:outline-none focus:border-accent-primary/50 w-44 transition-all"
                />
              </div>
              <select value={limit} onChange={e => fetchTable(1, +e.target.value)}
                className="bg-bg-base border border-border rounded-lg px-2 py-1.5 text-[12px] text-text-primary cursor-pointer focus:outline-none">
                {[25, 50, 100, 250].map(n => <option key={n} value={n}>{n} rows</option>)}
              </select>
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left" style={{ minWidth: 960 }}>
            <thead>
              <tr className="bg-bg-base/50 border-b border-border">
                {[
                  ['date_of_call', 'Date & Time'], ['agent_name', 'Agent'], ['investor_name', 'Client'],
                  ['purpose', 'Purpose'], ['nature', 'Nature'], ['severity', 'Severity'],
                  ['region', 'Region'], [null, 'Notes'], [null, ''],
                ].map(([key, lbl], i) => (
                  <th key={i}
                    onClick={key ? () => toggleSort(key) : undefined}
                    className={clsx('px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted',
                      i === 0 && 'pl-4', i === 8 && 'w-7 pr-4', key && 'cursor-pointer hover:text-text-primary transition-colors select-none')}>
                    {lbl}{key && <SortBtn col={key} sk={logSort.key} dir={logSort.dir} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedLog.map((log, i) => <LogRow key={log.log_id} log={log} idx={i} />)}
              {sortedLog.length === 0 && (
                <tr><td colSpan={9} className="py-16 text-center">
                  <Activity size={20} className="mx-auto mb-2 text-text-muted/30" />
                  <p className="text-[12px] text-text-muted/50">
                    {logSearch ? 'No rows match your search.' : 'No call records for the selected filters.'}
                  </p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3.5 border-t border-border flex items-center justify-between bg-bg-base/30 flex-wrap gap-2">
          <p className="text-[12px] text-text-muted">
            {logSearch && <><span className="font-semibold text-text-primary">{sortedLog.length}</span> of {tableData.length} filtered · </>}
            <span className="font-semibold text-text-primary">{totalRows}</span> total
          </p>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => fetchTable(page - 1, limit)}
              className="w-8 h-8 rounded-lg border border-border bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronRight size={14} className="rotate-180" />
            </button>
            <span className="text-[12px] text-text-muted px-1">
              Page <span className="font-semibold text-accent-primary">{page}</span> of {Math.ceil(totalRows / limit) || 1}
            </span>
            <button disabled={page >= Math.ceil(totalRows / limit)} onClick={() => fetchTable(page + 1, limit)}
              className="w-8 h-8 rounded-lg border border-border bg-bg-elevated flex items-center justify-center text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Date Logs Modal */}
      <AnimatePresence>
        {modalDate && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, backgroundColor: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setModalDate(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: '1000px', maxHeight: '90vh', background: 'var(--bg-surface)', borderRadius: '16px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                   <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Call Logs: {format(new Date(modalDate), 'dd/MM/yyyy')}</h3>
                   <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{modalLoading ? 'Loading...' : `${modalLogs.length} calls recorded on this day`}</p>
                </div>
                <button onClick={() => setModalDate(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', color: 'var(--text-muted)' }}><X size={20} /></button>
              </div>
              
              <div style={{ padding: '0', overflowY: 'auto', flex: 1, background: 'var(--bg)' }}>
                {modalLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                    <Activity className="spin mb-3" size={24} />
                    <p className="text-[13px]">Fetching call records...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left" style={{ minWidth: 960 }}>
                      <thead>
                        <tr className="bg-bg-base/50 border-b border-border">
                          {[
                            ['date_of_call', 'Date & Time'], ['agent_name', 'Agent'], ['investor_name', 'Client'],
                            ['purpose', 'Purpose'], ['nature', 'Nature'], ['severity', 'Severity'],
                            ['region', 'Region'], [null, 'Notes'], [null, ''],
                          ].map(([key, lbl], i) => (
                            <th key={i} className={clsx('px-3 py-3 text-[10px] font-bold uppercase tracking-wider text-text-muted', i === 0 && 'pl-4', i === 8 && 'w-7 pr-4')}>
                              {lbl}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {modalLogs.length === 0 ? (
                          <tr><td colSpan={9} className="py-16 text-center text-[13px] text-text-muted">No records found.</td></tr>
                        ) : (
                          modalLogs.map((log, i) => <LogRow key={log.log_id || i} log={log} idx={i} />)
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
