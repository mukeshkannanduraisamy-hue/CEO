import { useState, useEffect } from 'react';
import {
  Mail, MessageCircle, Zap, BarChart2,
  AlertCircle, Loader, TrendingUp, Activity, Send,
  Wifi, WifiOff, ArrowRight, Inbox
} from 'lucide-react';
import './Dashboard.css';

const API = import.meta.env.DEV ? 'http://localhost:8000' : '';
const WA  = import.meta.env.DEV ? 'http://localhost:3001' : '/wa';

function AnimatedNumber({ value, duration = 1000 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / (duration / 16));
    const timer = setInterval(() => {
      start = Math.min(start + step, value);
      setDisplay(start);
      if (start >= value) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span>{display.toLocaleString()}</span>;
}

export default function Dashboard({ onNavigate }) {
  const [stats, setStats] = useState({
    emailCampaigns: 0, waCampaigns: 0,
    totalSent: 0, totalFailed: 0,
    running: 0, successRate: 0,
    waConnected: false, zohoConnected: false,
  });
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [zohoStatus, emailCamps, waCamps] = await Promise.all([
          fetch(`${API}/api/zoho/status`).then(r => r.json()).catch(() => ({ connected: false })),
          fetch(`${API}/api/zoho/automail/status`).then(r => r.json()).catch(() => ({ campaigns: [] })),
          fetch(`${WA}/campaigns`, { signal: AbortSignal.timeout(3000) }).then(r => r.json()).catch(() => null),
        ]);

        const emailC = emailCamps.campaigns || [];
        const waC    = waCamps?.campaigns   || [];
        const allC   = [...emailC, ...waC];

        const totalSent   = allC.reduce((s, c) => s + (c.sent ?? c.success ?? 0), 0);
        const totalFailed = allC.reduce((s, c) => s + (c.failed ?? 0), 0);
        const running     = allC.filter(c => c.status === 'running' || c.status === 'queued').length;
        const rate        = (totalSent + totalFailed) > 0
          ? Math.round(totalSent / (totalSent + totalFailed) * 100) : 0;

        setStats({
          emailCampaigns: emailC.length,
          waCampaigns: waC.length,
          totalSent, totalFailed, running,
          successRate: rate,
          waConnected: waCamps !== null,
          zohoConnected: zohoStatus.connected,
        });
      } catch { /* keep defaults */ }
      finally { setLoading(false); }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const greetingHour = time.getHours();
  const greeting = greetingHour < 12 ? 'Good Morning' : greetingHour < 17 ? 'Good Afternoon' : 'Good Evening';

  const quickActions = [
    { id: 'mail',      label: 'Open Inbox',        icon: Inbox,          color: 'var(--mail)',  bg: 'var(--mail-bg)',  desc: 'Read & send emails' },
    { id: 'automail',  label: 'AutoMail Campaign',  icon: Zap,            color: 'var(--auto)',  bg: 'var(--auto-bg)',  desc: 'Send bulk emails' },
    { id: 'whatsapp',  label: 'WhatsApp Blast',     icon: MessageCircle,  color: 'var(--wa)',    bg: 'var(--wa-bg)',    desc: 'Bulk WA messaging' },
    { id: 'campaigns', label: 'View Campaigns',     icon: BarChart2,      color: 'var(--camp)',  bg: 'var(--camp-bg)',  desc: 'Track progress' },
  ];

  const statCards = [
    { label: 'Total Sent',     value: stats.totalSent,      icon: Send,         color: 'var(--mail)',  bg: 'var(--mail-bg)' },
    { label: 'Failed',         value: stats.totalFailed,    icon: AlertCircle,  color: 'var(--danger)', bg: 'var(--danger-bg)' },
    { label: 'Running',        value: stats.running,        icon: Activity,     color: 'var(--auto)',  bg: 'var(--auto-bg)',  spin: stats.running > 0 },
    { label: 'Success Rate',   value: `${stats.successRate}%`, icon: TrendingUp, color: 'var(--wa)',  bg: 'var(--wa-bg)', raw: true },
    { label: 'Email Campaigns',value: stats.emailCampaigns, icon: Mail,         color: '#818cf8',      bg: 'rgba(129,140,248,0.1)' },
    { label: 'WA Campaigns',   value: stats.waCampaigns,    icon: MessageCircle,color: 'var(--wa)',    bg: 'var(--wa-bg)' },
  ];

  return (
    <div className="db-root">
      {/* Hero Header */}
      <div className="db-hero">
        <div className="db-hero-glow db-hero-glow--1" />
        <div className="db-hero-glow db-hero-glow--2" />
        <div className="db-hero-glow db-hero-glow--3" />

        <div className="db-hero-content">
          <div className="db-greeting">{greeting} 👋</div>
          <h1 className="db-hero-title">CEO Command Center</h1>
          <p className="db-hero-sub">
            Your unified hub for email campaigns, WhatsApp automation, and engagement tracking.
          </p>

          {/* Status pills */}
          <div className="db-status-row">
            <div className={`db-status-pill ${stats.zohoConnected ? 'db-status-pill--on' : 'db-status-pill--off'}`}>
              {stats.zohoConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              Zoho {stats.zohoConnected ? 'Connected' : 'Offline'}
            </div>
            <div className={`db-status-pill ${stats.waConnected ? 'db-status-pill--on' : 'db-status-pill--off'}`}>
              {stats.waConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
              WhatsApp {stats.waConnected ? 'Connected' : 'Offline'}
            </div>
            {stats.running > 0 && (
              <div className="db-status-pill db-status-pill--running">
                <Loader size={12} className="spin" />
                {stats.running} Running
              </div>
            )}
          </div>
        </div>

        {/* Clock */}
        <div className="db-clock">
          <div className="db-clock-time">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="db-clock-date">
            {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      <div className="db-body">
        {/* Stats Grid */}
        <div className="db-section">
          <div className="db-section-header">
            <h2 className="db-section-title"><Activity size={16} /> Live Stats</h2>
          </div>
          <div className="db-stats-grid">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="db-stat-card skeleton" style={{ height: 88 }} />
              ))
            ) : statCards.map(({ label, value, icon: Icon, color, bg, spin, raw }) => (
              <div className="db-stat-card" key={label} style={{ '--card-color': color }}>
                <div className="db-stat-icon" style={{ background: bg, color }}>
                  <Icon size={20} className={spin ? 'spin' : ''} />
                </div>
                <div className="db-stat-info">
                  <div className="db-stat-value" style={{ color }}>
                    {raw ? value : <AnimatedNumber value={typeof value === 'number' ? value : 0} />}
                  </div>
                  <div className="db-stat-label">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="db-section">
          <div className="db-section-header">
            <h2 className="db-section-title"><Zap size={16} /> Quick Actions</h2>
          </div>
          <div className="db-actions-grid">
            {quickActions.map(({ id, label, icon: Icon, color, bg, desc }) => (
              <button
                key={id}
                className="db-action-card"
                onClick={() => onNavigate(id)}
                style={{ '--card-color': color }}
              >
                <div className="db-action-icon" style={{ background: bg, color }}>
                  <Icon size={22} />
                </div>
                <div className="db-action-info">
                  <div className="db-action-label">{label}</div>
                  <div className="db-action-desc">{desc}</div>
                </div>
                <ArrowRight size={16} className="db-action-arrow" style={{ color }} />
              </button>
            ))}
          </div>
        </div>

        {/* Feature Summary */}
        <div className="db-features-row">
          <div className="db-feature-card" style={{ '--fc': 'var(--mail)' }}>
            <div className="db-feature-icon"><Mail size={20} /></div>
            <div className="db-feature-body">
              <div className="db-feature-title">Zoho Mail</div>
              <div className="db-feature-desc">Read, compose, reply and manage your Zoho inbox with full attachment support.</div>
            </div>
          </div>
          <div className="db-feature-card" style={{ '--fc': 'var(--auto)' }}>
            <div className="db-feature-icon"><Zap size={20} /></div>
            <div className="db-feature-body">
              <div className="db-feature-title">AutoMail</div>
              <div className="db-feature-desc">Upload CSV, personalize templates, and send bulk email campaigns in one click.</div>
            </div>
          </div>
          <div className="db-feature-card" style={{ '--fc': 'var(--wa)' }}>
            <div className="db-feature-icon"><MessageCircle size={20} /></div>
            <div className="db-feature-body">
              <div className="db-feature-title">WhatsApp</div>
              <div className="db-feature-desc">Send bulk WhatsApp messages with images, documents and real-time delivery tracking.</div>
            </div>
          </div>
          <div className="db-feature-card" style={{ '--fc': 'var(--camp)' }}>
            <div className="db-feature-icon"><BarChart2 size={20} /></div>
            <div className="db-feature-body">
              <div className="db-feature-title">Campaigns</div>
              <div className="db-feature-desc">Track all email and WhatsApp campaigns with live progress, success rates and ETA.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
