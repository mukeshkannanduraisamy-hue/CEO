import { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud, Send, FileText, CheckCircle2, AlertCircle, Loader,
  ChevronDown, ChevronUp, X, Clock, Smartphone, BarChart2, RefreshCw,
  QrCode, WifiOff, StopCircle, Paperclip, FlaskConical,
  Trash2, Image, Timer, Users, Users2, Search, Calendar, Play
} from 'lucide-react';
import './WhatsAppSender.css';

const API = import.meta.env.DEV ? 'http://localhost:8000' : '';
const WA  = API + '/api/whatsapp';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtTime = iso => {
  if (!iso) return '';
  const s = iso.endsWith('Z') ? iso : iso + 'Z';
  return new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
const fmtEta = secs => {
  if (!secs || secs < 1) return '';
  if (secs < 60) return `~${secs}s left`;
  return `~${Math.ceil(secs / 60)}m left`;
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const StatusBadge = ({ status }) => {
  const cfg = {
    initializing:  { color: '#f59e0b', label: 'Initializing…', spin: true },
    qr_ready:      { color: '#6366f1', label: 'Scan QR Code',  spin: false },
    authenticated: { color: '#10b981', label: 'Authenticated', spin: false },
    ready:         { color: '#25d366', label: 'Connected',      spin: false },
    disconnected:  { color: '#ef4444', label: 'Disconnected',   spin: false },
  };
  const s = cfg[status] || cfg.disconnected;
  return (
    <span className="wa-badge" style={{ background: s.color + '20', color: s.color, borderColor: s.color + '44' }}>
      <span className={`wa-dot ${s.spin ? 'wa-pulse' : ''}`} style={{ background: s.color }} />
      {s.label}
    </span>
  );
};

const ProgressBar = ({ value, max, color = '#25d366' }) => (
  <div className="wa-track">
    <div className="wa-fill" style={{ width: `${max > 0 ? Math.round(value / max * 100) : 0}%`, background: color }} />
  </div>
);

const CampaignCard = ({ c, onCancel, onDelete }) => {
  const [open, setOpen] = useState(false);
  const pct = c.total > 0 ? Math.round((c.sent + c.failed) / c.total * 100) : 0;
  const isRunning = c.status === 'running' || c.status === 'queued';
  const colors = { completed: '#25d366', running: '#6366f1', queued: '#f59e0b', cancelled: '#64748b' };
  const col = colors[c.status] || '#64748b';

  return (
    <div className={`wa-card wa-card--${c.status}`}>
      <div className="wa-card-top">
        <div className="wa-card-meta">
          <span className="wa-card-badge" style={{ color: col, background: col + '18' }}>
            {isRunning ? <Loader size={10} className="wa-spin" /> : <CheckCircle2 size={10} />}
            {c.status}
          </span>
          {c.type === 'group' && <span className="wa-card-badge" style={{ color: '#8b5cf6', background: '#8b5cf620' }}><Users2 size={10} /> group</span>}
          {c.has_attachment && <span className="wa-card-badge" style={{ color: '#818cf8', background: '#6366f120' }}><Paperclip size={10} /> file</span>}
          <span className="wa-card-preview">{c.preview}</span>
        </div>
        <div className="wa-card-actions">
          <button className="wa-ibtn" onClick={() => setOpen(v => !v)}>
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {isRunning
            ? <button className="wa-ibtn wa-ibtn--danger" onClick={() => onCancel(c.id)} title="Cancel"><StopCircle size={13} /></button>
            : <button className="wa-ibtn wa-ibtn--danger" onClick={() => onDelete(c.id)} title="Delete"><Trash2 size={13} /></button>
          }
        </div>
      </div>

      <div className="wa-card-prog">
        <ProgressBar value={c.sent + c.failed} max={c.total} color={col} />
        <div className="wa-prog-row">
          <span className="wa-pill wa-pill--green"><CheckCircle2 size={9} /> {c.sent} sent</span>
          {c.failed > 0 && <span className="wa-pill wa-pill--red"><AlertCircle size={9} /> {c.failed} failed</span>}
          {isRunning && (c.total - c.sent - c.failed) > 0 &&
            <span className="wa-pill wa-pill--blue"><Clock size={9} /> {c.total - c.sent - c.failed} pending</span>}
          {isRunning && c.eta_seconds > 0 &&
            <span className="wa-pill wa-pill--muted"><Timer size={9} /> {fmtEta(c.eta_seconds)}</span>}
          <span className="wa-pill wa-pill--muted" style={{ marginLeft: 'auto' }}>{pct}%</span>
        </div>
      </div>

      {open && (
        <div className="wa-card-detail">
          <div className="wa-detail-row"><span>Started</span><span>{fmtTime(c.started_at)}</span></div>
          {c.finished_at && <div className="wa-detail-row"><span>Finished</span><span>{fmtTime(c.finished_at)}</span></div>}
          <div className="wa-detail-row"><span>Total</span><span>{c.total} contacts</span></div>
          {c.errors?.length > 0 && (
            <div className="wa-errors">
              <div className="wa-errors-title"><AlertCircle size={11} /> Failed numbers</div>
              {c.errors.slice(0, 6).map((e, i) => <div key={i} className="wa-error-item">{e}</div>)}
              {c.errors.length > 6 && <div className="wa-errors-title">+{c.errors.length - 6} more</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main ───────────────────────────────────────────────────────────────────────
export default function WhatsAppSender() {
  const [waStatus, setWaStatus]       = useState('initializing');
  const [qrImage, setQrImage]         = useState(null);
  const [campaigns, setCampaigns]     = useState([]);
  const [csvFile, setCsvFile]         = useState(null);
  const [csvHeaders, setCsvHeaders]   = useState([]);
  const [csvRows, setCsvRows]         = useState([]);
  const [csvCount, setCsvCount]       = useState(0);
  const [contacts, setContacts]       = useState([]);
  const [message, setMessage]         = useState('');
  const [attachment, setAttachment]   = useState(null); // { file, base64, mimetype, name }
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [isSending, setIsSending]     = useState(false);
  const [isDragging, setIsDragging]   = useState(false);
  const [serviceDown, setServiceDown] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [testPhone, setTestPhone]     = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult]   = useState(null);
  const [activeTab, setActiveTab]     = useState('compose'); // compose | groups | test | history
  const csvRef = useRef();
  const attRef = useRef();
  const pollCamp   = useRef(null);
  const pollStatus = useRef(null);
  const [toast, setToast] = useState(null);

  // ── Groups state ──
  const [groups,         setGroups]         = useState([]);
  const [groupsLoading,  setGroupsLoading]  = useState(false);
  const [groupsError,    setGroupsError]    = useState('');
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [groupMessage,   setGroupMessage]   = useState('');
  const [groupAttachment,setGroupAttachment]= useState(null);
  const [groupSending,   setGroupSending]   = useState(false);
  const [groupSearch,    setGroupSearch]    = useState('');
  const groupAttRef = useRef();

  // ── Schedule state ──
  const [schFile,        setSchFile]        = useState(null);
  const [schDate,        setSchDate]        = useState('');
  const [schTime,        setSchTime]        = useState('');
  const [schMessage,     setSchMessage]     = useState('');
  const [schAttachment,  setSchAttachment]  = useState(null);
  const [schJobs,        setSchJobs]        = useState([]);
  const [schLoading,     setSchLoading]     = useState(false);
  const [schStatus,      setSchStatus]      = useState('');
  const schFileRef = useRef();
  const schAttRef  = useRef();

  const notify = (msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${WA}/status`, { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      setWaStatus(d.status);
      setQrImage(d.qr || null);
      setServiceDown(false);
    } catch {
      setServiceDown(true);
      setWaStatus('disconnected');
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    try {
      const r = await fetch(`${WA}/campaigns`, { signal: AbortSignal.timeout(2500) });
      const d = await r.json();
      setCampaigns(d.campaigns || []);
    } catch (e) { console.error('Failed to fetch campaigns', e); }
  }, []);

  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true);
    setGroupsError('');
    try {
      const r = await fetch(`${WA}/groups`, { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      if (!r.ok) { setGroupsError(d.error || 'Failed to load groups'); return; }
      setGroups(d.groups || []);
    } catch (e) {
      setGroupsError('Cannot reach WhatsApp service.');
    } finally { setGroupsLoading(false); }
  }, []);

  // Status poll — every 3s
  useEffect(() => {
    fetchStatus();
    pollStatus.current = setInterval(fetchStatus, 3000);
    return () => clearInterval(pollStatus.current);
  }, [fetchStatus]);

  // Auto-fetch groups when WA becomes ready
  useEffect(() => {
    if (waStatus === 'ready' && groups.length === 0) fetchGroups();
  }, [waStatus, groups.length, fetchGroups]);

  // Campaign poll — every 1.5s while running
  useEffect(() => {
    const running = campaigns.some(c => c.status === 'running' || c.status === 'queued');
    if (running && !pollCamp.current) {
      pollCamp.current = setInterval(fetchCampaigns, 1500);
    } else if (!running && pollCamp.current) {
      clearInterval(pollCamp.current);
      pollCamp.current = null;
    }
  }, [campaigns, fetchCampaigns]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // CSV parse
  const parseCsv = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return;
      
      const firstLine = lines[0];
      const sep = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
      
      const headers = firstLine.split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));
      const rows = lines.slice(1, 6).map(line =>
        line.split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''))
      );
      
      setCsvHeaders(headers);
      setCsvRows(rows);
      setCsvCount(lines.length - 1);
      setShowPreview(true);

      const phoneIdx = headers.findIndex(h => {
        const lower = h.toLowerCase();
        return lower.includes('phone') || lower.includes('mobile') || lower.includes('contact') || lower.includes('number') || lower.includes('whatsapp');
      });
      if (phoneIdx === -1) {
        notify('No "Phone" or "Mobile" column detected in CSV!', 'error');
        return;
      }

      const allContacts = lines.slice(1).map(line => {
        const parts = line.split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''));
        const contact = {};
        headers.forEach((h, i) => contact[h] = parts[i] || '');
        return contact;
      }).filter(c => c[headers[phoneIdx]]);

      setContacts(allContacts);
    };
    reader.readAsText(file);
  };

  const handleCsvChange = e => { const f = e.target.files?.[0]; if (f) { setCsvFile(f); parseCsv(f); } };
  const handleDrop = e => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setCsvFile(f); parseCsv(f); }
  };
  const clearCsv = e => {
    e.stopPropagation();
    setCsvFile(null); setCsvHeaders([]); setCsvRows([]); setCsvCount(0); setContacts([]);
  };

  const handleAttachmentChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { notify('Attachment must be under 16 MB (WhatsApp limit).', 'error'); return; }
    const base64 = await fileToBase64(file);
    setAttachment({ file, base64, mimetype: file.type, name: file.name });
  };
  const clearAttachment = () => {
    setAttachment(null);
    if (attRef.current) attRef.current.value = '';
  };

  const insertPlaceholder = (col) => setMessage(prev => prev + `{${col}}`);

  const handleSend = async () => {
    if (!csvFile || !message.trim()) return;
    if (waStatus !== 'ready') { notify('WhatsApp is not connected. Please scan the QR code first.', 'error'); return; }
    setIsSending(true);
    try {
      const body = {
        contacts,
        message,
        delay_seconds: delaySeconds,
        attachment: attachment ? { data: attachment.base64, mimetype: attachment.mimetype, filename: attachment.name } : null,
      };
      const resp = await fetch(`${WA}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (resp.ok) {
        setCsvFile(null); setCsvHeaders([]); setCsvRows([]); setCsvCount(0); setContacts([]);
        setMessage(''); setAttachment(null);
        notify('Campaign dispatched! Watch live progress in History tab.', 'success');
        await fetchCampaigns();
        setActiveTab('history');
        if (!pollCamp.current) pollCamp.current = setInterval(fetchCampaigns, 1500);
      } else {
        notify(`Error: ${data.error || data.detail || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      notify(`Cannot reach WhatsApp service on port 3001. Is node index.js running?`, 'error');
    } finally { setIsSending(false); }
  };

  const handleTest = async () => {
    if (!testPhone.trim() || !testMessage.trim()) return;
    if (waStatus !== 'ready') { notify('WhatsApp not connected. Scan the QR code first.', 'error'); return; }
    setTestSending(true); setTestResult(null);
    try {
      const body = {
        phone: testPhone.trim(),
        message: testMessage,
        attachment: attachment ? { data: attachment.base64, mimetype: attachment.mimetype, filename: attachment.name } : null,
      };
      const resp = await fetch(`${WA}/test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await resp.json();
      setTestResult(resp.ok ? { ok: true, msg: `✓ Sent successfully to ${testPhone}` } : { ok: false, msg: data.error });
    } catch (err) {
      setTestResult({ ok: false, msg: err.message });
    } finally { setTestSending(false); }
  };

  const handleCancel = async (id) => {
    await fetch(`${WA}/campaigns/${id}/cancel`, { method: 'POST' });
    fetchCampaigns();
  };
  const handleDelete = async (id) => {
    await fetch(`${WA}/campaigns/${id}`, { method: 'DELETE' });
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };
  const handleLogout = async () => {
    await fetch(`${WA}/logout`, { method: 'POST' });
    notify('WhatsApp disconnected. Scan the QR code to reconnect.', 'info');
  };

  // ── Group handlers ──────────────────────────────────────────────────────────
  const toggleGroup = (id) => setSelectedGroups(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = () => {
    const visible = filteredGroups.map(g => g.id);
    const allSelected = visible.every(id => selectedGroups.has(id));
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (allSelected) visible.forEach(id => next.delete(id));
      else visible.forEach(id => next.add(id));
      return next;
    });
  };

  const handleGroupAttachmentChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) { notify('Attachment must be under 16 MB.', 'error'); return; }
    const base64 = await fileToBase64(file);
    setGroupAttachment({ file, base64, mimetype: file.type, name: file.name });
  };

  const handleGroupSend = async () => {
    if (selectedGroups.size === 0 || !groupMessage.trim()) return;
    if (waStatus !== 'ready') { notify('WhatsApp not connected. Scan the QR code first.', 'error'); return; }
    setGroupSending(true);
    try {
      const body = {
        group_ids: Array.from(selectedGroups),
        message:   groupMessage,
        attachment: groupAttachment
          ? { data: groupAttachment.base64, mimetype: groupAttachment.mimetype, filename: groupAttachment.name }
          : null,
      };
      const resp = await fetch(`${WA}/groups/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (resp.ok) {
        setSelectedGroups(new Set());
        setGroupMessage('');
        setGroupAttachment(null);
        notify(`Group campaign dispatched to ${data.total} groups!`, 'success');
        await fetchCampaigns();
        setActiveTab('history');
        if (!pollCamp.current) pollCamp.current = setInterval(fetchCampaigns, 1500);
      } else {
        notify(`Error: ${data.error || data.detail || 'Unknown error'}`, 'error');
      }
    } catch {
      notify('Cannot reach WhatsApp service.', 'error');
    } finally { setGroupSending(false); }
  };

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const tabs = [
    ['compose',  'Bulk Campaign'],
    ['groups',   `Groups (${groups.length})`],
    ['schedule', 'Schedule'],
    ['test',     'Test Message'],
    ['history',  `History (${campaigns.length})`],
  ];
  const handleTabSwitch = (t) => {
    if (t === 'test' && !testMessage && message) setTestMessage(message);
    if (t === 'groups' && waStatus === 'ready' && groups.length === 0) fetchGroups();
    if (t === 'schedule') fetchSchJobs();
    setActiveTab(t);
  };

  const fetchSchJobs = async () => {
    try {
      const r = await fetch(`${API}/api/schedule`);
      if (r.ok) { const d = await r.json(); setSchJobs(d.jobs?.filter(j => j.type === 'whatsapp') || []); }
    } catch {}
  };

  const handleSchSubmit = async (e) => {
    e.preventDefault();
    if (!schFile || !schDate || !schTime || !schMessage.trim()) {
      setSchStatus('Please fill all fields.'); return;
    }
    setSchLoading(true); setSchStatus('Scheduling...');
    const fd = new FormData();
    fd.append('csv_file', schFile);
    fd.append('type', 'whatsapp');
    fd.append('target_datetime', `${schDate}T${schTime}`);
    fd.append('message', schMessage);
    if (schAttachment) fd.append('attachment', schAttachment.file);
    try {
      const r = await fetch(`${API}/api/schedule`, { method: 'POST', body: fd });
      const d = await r.json();
      if (r.ok) {
        setSchStatus(`✓ Scheduled! Job ID: ${d.job_id}`);
        setSchFile(null); setSchMessage(''); setSchDate(''); setSchTime(''); setSchAttachment(null);
        setCsvHeaders([]); setCsvRows([]);
        if (schFileRef.current) schFileRef.current.value = '';
        fetchSchJobs();
      } else { setSchStatus(`Error: ${d.detail}`); }
    } catch (err) { setSchStatus(`Error: ${err.message}`); }
    setSchLoading(false);
  };

  const handleSchDelete = async (id) => {
    await fetch(`${API}/api/schedule/${id}`, { method: 'DELETE' });
    fetchSchJobs();
  };

  return (
    <>
    <div className="wa-root">
      {/* Header */}
      <div className="wa-header">
        <div>
          <h1 className="wa-title"><Smartphone size={22} /> WhatsApp Bulk Engine</h1>
          <p className="wa-subtitle">Free bulk messaging via WhatsApp Web — no API cost</p>
        </div>
        <div className="wa-header-right">
          <StatusBadge status={waStatus} />
          <button className="wa-ibtn" onClick={() => { fetchStatus(); fetchCampaigns(); }} title="Refresh"><RefreshCw size={14} /></button>
          {waStatus === 'ready' && <button className="wa-logout-btn" onClick={handleLogout}><WifiOff size={13} /> Disconnect</button>}
        </div>
      </div>

      {/* Service down alert */}
      {serviceDown && (
        <div className="wa-alert wa-alert--error">
          <AlertCircle size={15} />
          WhatsApp Selenium engine is offline. Please restart the backend: <code>.\start_local.ps1</code> then open WhatsApp Web and scan the QR code.
        </div>
      )}

      {/* QR Code */}
      {waStatus === 'qr_ready' && qrImage && (
        <div className="wa-qr-panel">
          <div className="wa-qr-info">
            <QrCode size={32} className="wa-qr-icon" />
            <div>
              <div className="wa-qr-title">Scan QR Code to Connect</div>
              <div className="wa-qr-steps">
                <span>1. Open WhatsApp on your phone</span>
                <span>2. Tap ⋮ → Linked Devices → Link a Device</span>
                <span>3. Point your camera at the QR code →</span>
              </div>
            </div>
          </div>
          <img src={qrImage} alt="WhatsApp QR" className="wa-qr-img" />
        </div>
      )}

      {/* Tabs */}
      <div className="wa-tabs">
        {tabs.map(([t, l]) => (
          <button key={t} className={`wa-tab ${activeTab === t ? 'active' : ''}`} onClick={() => handleTabSwitch(t)}>{l}</button>
        ))}
      </div>

      {/* ── COMPOSE TAB ── */}
      {activeTab === 'compose' && (
        <div className="wa-layout">
          <div className="wa-compose-panel">
            {/* CSV Upload */}
            <div className="wa-section-title"><Users size={13} /> 1 · Recipients CSV</div>
            <div
              className={`wa-drop ${isDragging ? 'wa-drop--drag' : ''} ${csvFile ? 'wa-drop--has' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => csvRef.current.click()}
              style={csvFile ? { padding: '8px 12px' } : {}}
            >
              <input ref={csvRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvChange} />
              {csvFile ? (
                <div className="wa-file-row">
                  <FileText size={20} color="#25d366" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="wa-file-name" style={{ fontSize: 13 }}>{csvFile.name}</div>
                    <div className="wa-file-sub" style={{ fontSize: 11 }}>{csvCount} contacts detected</div>
                  </div>
                  <button className="wa-ibtn wa-ibtn--danger" onClick={clearCsv}><X size={13} /></button>
                </div>
              ) : (
                <>
                  <UploadCloud size={24} color="#25d366" opacity={0.6} />
                  <div className="wa-drop-label" style={{ fontSize: 13 }}>Click to upload CSV</div>
                  <div className="wa-drop-sub" style={{ fontSize: 11 }}>Needs a <strong>Phone</strong> column</div>
                </>
              )}
            </div>

            {/* CSV Preview */}
            {csvHeaders.length > 0 && (
              <div className="wa-csv-box" style={{ 
                background: '#fff', 
                padding: '10px', 
                borderRadius: 8, 
                border: '2px solid #25d366', 
                boxShadow: '0 4px 12px rgba(37,211,102,0.1)'
              }}>
                <div className="wa-section-title" style={{ fontSize: 11, marginBottom: 8, color: '#128c7e' }}>
                  <FileText size={12} /> Data Preview (First 5 rows)
                </div>
                
                <div className="wa-table-wrap" style={{ maxHeight: 120, border: '1px solid #eee' }}>
                  <table className="wa-table" style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f0fdf4' }}>
                        {csvHeaders.map(h => (
                          <th key={h} style={{ padding: '6px 10px', borderBottom: '2px solid #25d366', borderRight: '1px solid #eee', textAlign: 'left' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((row, i) => (
                        <tr key={i}>
                          {row.map((cell, j) => (
                            <td key={j} style={{ padding: '6px 10px', borderBottom: '1px solid #eee', borderRight: '1px solid #eee', color: '#444' }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="wa-section-title" style={{ marginTop: 10, marginBottom: 6, fontSize: 11 }}>Click to insert variable:</div>
                <div className="wa-chips">
                  {csvHeaders.map(h => <button key={h} className="wa-chip" onClick={() => insertPlaceholder(h)} style={{ padding: '4px 8px', fontSize: 11 }}>{`{${h}}`}</button>)}
                </div>
              </div>
            )}

            {/* Message */}
            <div className="wa-section-title">2 · Message Template</div>
            <textarea
              className="wa-textarea"
              placeholder={"Hi {Name}! 👋\n\nJust a quick update regarding {Company}.\n\nStatus: {Status}\n\nFeel free to reply anytime."}
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
            <div className="wa-char">{message.length} chars · {message.split('\n').length} lines</div>

            {/* Attachment */}
            <div className="wa-section-title"><Paperclip size={13} /> 3 · Attachment <span className="wa-opt">(optional · max 16MB)</span></div>
            {attachment ? (
              <div className="wa-att-row">
                <Image size={16} color="#818cf8" />
                <span className="wa-att-name">{attachment.name}</span>
                <span className="wa-att-size">{(attachment.file.size / 1024).toFixed(0)} KB</span>
                <button className="wa-ibtn wa-ibtn--danger" onClick={clearAttachment}><X size={13} /></button>
              </div>
            ) : (
              <button className="wa-att-btn" onClick={() => attRef.current.click()}>
                <Paperclip size={14} /> Select Image / Document / Video
              </button>
            )}
            <input ref={attRef} type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{display:'none'}} onChange={handleAttachmentChange} />

            {/* Delay */}
            <div className="wa-section-title"><Timer size={13} /> 4 · Send Delay <span className="wa-opt">(seconds between messages)</span></div>
            <div className="wa-delay-row">
              {[1, 2, 3, 5].map(d => (
                <button key={d} className={`wa-delay-btn ${delaySeconds === d ? 'active' : ''}`} onClick={() => setDelaySeconds(d)}>{d}s</button>
              ))}
              <span className="wa-eta-label">Est. total: ~{Math.ceil((contacts.length * delaySeconds) / 60) || 0}m</span>
            </div>

            <button
              className="wa-send-btn"
              onClick={handleSend}
              disabled={isSending || !csvFile || !message.trim() || waStatus !== 'ready'}
            >
              {isSending
                ? <><Loader size={17} className="wa-spin" /> Dispatching…</>
                : <><Send size={17} /> Send to {csvCount || 0} contacts {attachment ? '(+attachment)' : ''}</>
              }
            </button>
            {waStatus !== 'ready' && csvFile && (
              <div className="wa-warn"><AlertCircle size={13} /> Connect WhatsApp first.</div>
            )}
          </div>

          {/* Right: Bubble Preview */}
          <div className="wa-right">
            <div className="wa-preview-card">
              <div className="wa-section-title"><Smartphone size={13} /> Message Preview</div>
              <div className="wa-chat-bg">
                {attachment && (
                  <div className="wa-media-preview">
                    {attachment.mimetype.startsWith('image/') ? (
                      <img src={URL.createObjectURL(attachment.file)} alt="preview" className="wa-media-img" />
                    ) : (
                      <div className="wa-media-file"><Paperclip size={18} /> {attachment.name}</div>
                    )}
                  </div>
                )}
                <div className="wa-bubble">
                  {message || <span style={{opacity:0.3}}>Your message will appear here…</span>}
                </div>
                <div className="wa-bubble-meta">now · ✓✓</div>
              </div>
            </div>

            {/* Stats */}
            <div className="wa-stats-card">
              <div className="wa-section-title"><BarChart2 size={13} /> Campaign Summary</div>
              <div className="wa-stats-grid">
                <div className="wa-stat"><div className="wa-stat-val">{csvCount}</div><div className="wa-stat-lbl">Recipients</div></div>
                <div className="wa-stat"><div className="wa-stat-val">{delaySeconds}s</div><div className="wa-stat-lbl">Delay</div></div>
                <div className="wa-stat"><div className="wa-stat-val">{attachment ? '1' : '0'}</div><div className="wa-stat-lbl">Attachments</div></div>
                <div className="wa-stat"><div className="wa-stat-val">{contacts.length * delaySeconds > 60 ? `${Math.ceil((contacts.length * delaySeconds)/60)}m` : `${contacts.length * delaySeconds}s`}</div><div className="wa-stat-lbl">Est. Time</div></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TEST TAB ── */}
      {activeTab === 'test' && (
        <div className="wa-test-panel">
          <div className="wa-test-card">
            <div className="wa-section-title"><FlaskConical size={13} /> Test Single Message</div>
            <p className="wa-test-hint">Send a test message to one number before launching the full campaign. You can edit the message below.</p>

            <label className="wa-section-title" style={{marginBottom:4}}>Phone Number</label>
            <input
              className="wa-input"
              placeholder="e.g. 919876543210 (include country code)"
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
            />

            <label className="wa-section-title" style={{marginBottom:4}}>Message</label>
            <textarea
              className="wa-textarea"
              placeholder="Type your test message here…"
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              style={{ minHeight: 120 }}
            />
            <div className="wa-char">{testMessage.length} characters</div>

            {attachment && (
              <div className="wa-att-row">
                <Paperclip size={14} color="#818cf8"/>
                <span className="wa-att-name">{attachment.name}</span>
                <span className="wa-att-size">will be attached</span>
              </div>
            )}

            <button
              className="wa-send-btn"
              onClick={handleTest}
              disabled={testSending || !testPhone.trim() || !testMessage.trim() || waStatus !== 'ready'}
            >
              {testSending ? <><Loader size={16} className="wa-spin" /> Sending…</> : <><Send size={16} /> Send Test Message</>}
            </button>

            {waStatus !== 'ready' && (
              <div className="wa-warn"><AlertCircle size={13} /> Connect WhatsApp first to send test messages.</div>
            )}

            {testResult && (
              <div className={`wa-alert ${testResult.ok ? 'wa-alert--success' : 'wa-alert--error'}`}>
                {testResult.ok ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>}
                {testResult.msg}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── GROUPS TAB ── */}
      {activeTab === 'groups' && (
        <div className="wa-layout">
          {/* Left: Group selector */}
          <div className="wa-compose-panel">
            <div className="wa-section-title"><Users2 size={13} /> 1 · Select Groups</div>

            {waStatus !== 'ready' ? (
              <div className="wa-warn"><AlertCircle size={13} /> Connect WhatsApp first to see your groups.</div>
            ) : groupsError ? (
              <div className="wa-alert wa-alert--error"><AlertCircle size={14}/> {groupsError}
                <button className="wa-ibtn" style={{marginLeft:8}} onClick={fetchGroups}><RefreshCw size={12}/></button>
              </div>
            ) : (
              <>
                {/* Search + Select-all row */}
                <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                  <div style={{ position:'relative', flex:1 }}>
                    <Search size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'#94a3b8', pointerEvents:'none' }}/>
                    <input
                      className="wa-input"
                      style={{ paddingLeft:28 }}
                      placeholder="Search groups…"
                      value={groupSearch}
                      onChange={e => setGroupSearch(e.target.value)}
                    />
                  </div>
                  <button className="wa-delay-btn" onClick={fetchGroups} title="Refresh groups">
                    {groupsLoading ? <Loader size={12} className="wa-spin"/> : <RefreshCw size={12}/>}
                  </button>
                </div>

                {/* Select all / deselect all */}
                {filteredGroups.length > 0 && (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6, fontSize:11, color:'#64748b' }}>
                    <span>{selectedGroups.size} of {filteredGroups.length} selected</span>
                    <button className="wa-chip" onClick={toggleAll} style={{ fontSize:10, padding:'2px 8px' }}>
                      {filteredGroups.every(g => selectedGroups.has(g.id)) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                )}

                {/* Group list */}
                <div style={{ maxHeight: 340, overflowY:'auto', borderRadius:8, border:'1px solid #e2e8f0' }}>
                  {groupsLoading ? (
                    <div style={{ padding:24, textAlign:'center', color:'#94a3b8' }}><Loader size={20} className="wa-spin"/> Loading groups…</div>
                  ) : filteredGroups.length === 0 ? (
                    <div style={{ padding:24, textAlign:'center', color:'#94a3b8' }}>
                      {groups.length === 0 ? 'No groups found. Make sure WhatsApp is connected.' : 'No groups match your search.'}
                    </div>
                  ) : filteredGroups.map(g => (
                    <label key={g.id} style={{
                      display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                      borderBottom:'1px solid #f1f5f9', cursor:'pointer',
                      background: selectedGroups.has(g.id) ? '#f0fdf4' : '#fff',
                      transition:'background 0.15s',
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedGroups.has(g.id)}
                        onChange={() => toggleGroup(g.id)}
                        style={{ width:15, height:15, accentColor:'#25d366', cursor:'pointer' }}
                      />
                      <div style={{ width:34, height:34, borderRadius:'50%', background:'#dcfce7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Users2 size={16} color="#16a34a"/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:600, fontSize:13, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.name}</div>
                        <div style={{ fontSize:11, color:'#64748b' }}>{g.participants} participants</div>
                      </div>
                      {selectedGroups.has(g.id) && <CheckCircle2 size={15} color="#25d366" style={{ flexShrink:0 }}/>}
                    </label>
                  ))}
                </div>
              </>
            )}

            {/* Message */}
            <div className="wa-section-title" style={{ marginTop:14 }}>2 · Message</div>
            <textarea
              className="wa-textarea"
              placeholder="Type your group message here…"
              value={groupMessage}
              onChange={e => setGroupMessage(e.target.value)}
            />
            <div className="wa-char">{groupMessage.length} chars</div>

            {/* Attachment */}
            <div className="wa-section-title"><Paperclip size={13}/> 3 · Attachment <span className="wa-opt">(optional · max 16MB)</span></div>
            {groupAttachment ? (
              <div className="wa-att-row">
                <Image size={16} color="#818cf8"/>
                <span className="wa-att-name">{groupAttachment.name}</span>
                <span className="wa-att-size">{(groupAttachment.file.size/1024).toFixed(0)} KB</span>
                <button className="wa-ibtn wa-ibtn--danger" onClick={() => { setGroupAttachment(null); if(groupAttRef.current) groupAttRef.current.value=''; }}><X size={13}/></button>
              </div>
            ) : (
              <button className="wa-att-btn" onClick={() => groupAttRef.current.click()}>
                <Paperclip size={14}/> Select Image / Document / Video
              </button>
            )}
            <input ref={groupAttRef} type="file" accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx" style={{display:'none'}} onChange={handleGroupAttachmentChange}/>

            <button
              className="wa-send-btn"
              style={{ marginTop:14 }}
              onClick={handleGroupSend}
              disabled={groupSending || selectedGroups.size === 0 || !groupMessage.trim() || waStatus !== 'ready'}
            >
              {groupSending
                ? <><Loader size={17} className="wa-spin"/> Sending…</>
                : <><Send size={17}/> Send to {selectedGroups.size} group{selectedGroups.size !== 1 ? 's' : ''}{groupAttachment ? ' (+attachment)' : ''}</>
              }
            </button>
            {waStatus !== 'ready' && (
              <div className="wa-warn"><AlertCircle size={13}/> Connect WhatsApp first.</div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="wa-right">
            <div className="wa-preview-card">
              <div className="wa-section-title"><Smartphone size={13}/> Message Preview</div>
              <div className="wa-chat-bg">
                {groupAttachment && (
                  <div className="wa-media-preview">
                    {groupAttachment.mimetype.startsWith('image/') ? (
                      <img src={URL.createObjectURL(groupAttachment.file)} alt="preview" className="wa-media-img"/>
                    ) : (
                      <div className="wa-media-file"><Paperclip size={18}/> {groupAttachment.name}</div>
                    )}
                  </div>
                )}
                <div className="wa-bubble">
                  {groupMessage || <span style={{opacity:0.3}}>Your message will appear here…</span>}
                </div>
                <div className="wa-bubble-meta">now · ✓✓</div>
              </div>
            </div>

            <div className="wa-stats-card">
              <div className="wa-section-title"><BarChart2 size={13}/> Summary</div>
              <div className="wa-stats-grid">
                <div className="wa-stat"><div className="wa-stat-val">{groups.length}</div><div className="wa-stat-lbl">Total Groups</div></div>
                <div className="wa-stat"><div className="wa-stat-val">{selectedGroups.size}</div><div className="wa-stat-lbl">Selected</div></div>
                <div className="wa-stat"><div className="wa-stat-val">{groupAttachment ? '1' : '0'}</div><div className="wa-stat-lbl">Attachments</div></div>
                <div className="wa-stat"><div className="wa-stat-val">~{Math.ceil(selectedGroups.size * 6 / 60) || 0}m</div><div className="wa-stat-lbl">Est. Time</div></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SCHEDULE TAB ── */}
      {activeTab === 'schedule' && (
        <div className="wa-layout">
          {/* Left: Form */}
          <div className="wa-compose-panel">
            <div className="wa-section-title"><Calendar size={13}/> Schedule WhatsApp Batch</div>
            <form onSubmit={handleSchSubmit} style={{display:'flex',flexDirection:'column',gap:12,marginTop:8}}>
              <div>
                <label style={{fontSize:12,fontWeight:500,color:'#64748b',display:'block',marginBottom:4}}>1 · Upload Batch CSV</label>
                <div
                  className={`wa-drop ${isDragging ? 'wa-drop--drag' : ''} ${schFile ? 'wa-drop--has' : ''}`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault(); setIsDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) { setSchFile(f); parseCsv(f); }
                  }}
                  onClick={() => schFileRef.current.click()}
                  style={schFile ? { padding: '8px 12px' } : {}}
                >
                  <input ref={schFileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setSchFile(f); parseCsv(f); } }} />
                  {schFile ? (
                    <div className="wa-file-row">
                      <FileText size={20} color="#25d366" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="wa-file-name" style={{ fontSize: 13 }}>{schFile.name}</div>
                        <div className="wa-file-sub" style={{ fontSize: 11 }}>Ready to schedule</div>
                      </div>
                      <button type="button" className="wa-ibtn wa-ibtn--danger" onClick={(e) => { e.stopPropagation(); setSchFile(null); setCsvHeaders([]); setCsvRows([]); }}><X size={13} /></button>
                    </div>
                  ) : (
                    <>
                      <UploadCloud size={24} color="#25d366" opacity={0.6} />
                      <div className="wa-drop-label" style={{ fontSize: 13 }}>Click to upload CSV</div>
                    </>
                  )}
                </div>
              </div>

              {/* CSV Preview */}
              {schFile && csvHeaders.length > 0 && (
                <div className="wa-csv-box" style={{ 
                  background: '#fff', padding: '10px', borderRadius: 8, border: '2px solid #25d366', boxShadow: '0 4px 12px rgba(37,211,102,0.1)'
                }}>
                  <div className="wa-section-title" style={{ fontSize: 11, marginBottom: 8, color: '#128c7e' }}><FileText size={12} /> Data Preview</div>
                  <div className="wa-table-wrap" style={{ maxHeight: 120, border: '1px solid #eee' }}>
                    <table className="wa-table" style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: '#f0fdf4' }}>{csvHeaders.map(h => <th key={h} style={{ padding: '6px 10px', borderBottom: '2px solid #25d366', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                      <tbody>{csvRows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={{ padding: '6px 10px', borderBottom: '1px solid #eee', color: '#444' }}>{cell}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                  <div className="wa-section-title" style={{ marginTop: 10, marginBottom: 6, fontSize: 11 }}>Click to insert variable:</div>
                  <div className="wa-chips">
                    {csvHeaders.map(h => <button type="button" key={h} className="wa-chip" onClick={() => setSchMessage(prev => prev + `{${h}}`)} style={{ padding: '4px 8px', fontSize: 11 }}>{`{${h}}`}</button>)}
                  </div>
                </div>
              )}

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div>
                  <label style={{fontSize:12,fontWeight:500,color:'#64748b',display:'block',marginBottom:4}}><Calendar size={12} style={{verticalAlign:'middle'}}/> 2 · Date</label>
                  <input type="date" className="wa-input" value={schDate} onChange={e=>setSchDate(e.target.value)} required />
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:500,color:'#64748b',display:'block',marginBottom:4}}><Clock size={12} style={{verticalAlign:'middle'}}/> 3 · Time</label>
                  <input type="time" className="wa-input" value={schTime} onChange={e=>setSchTime(e.target.value)} required />
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:500,color:'#64748b',display:'block',marginBottom:4}}>4 · Message Template</label>
                <textarea className="wa-msg" rows={4} placeholder="Your message... use {ColumnName} to personalize"
                  value={schMessage} onChange={e=>setSchMessage(e.target.value)} required />
              </div>

              {/* Attachment selection */}
              <div>
                <label style={{fontSize:12,fontWeight:500,color:'#64748b',display:'block',marginBottom:4}}>5 · Attachment (optional)</label>
                {schAttachment ? (
                  <div className="wa-file-row" style={{border:'1px solid #e2e8f0', padding:'8px 12px', borderRadius:8}}>
                    <Paperclip size={18} color="#818cf8"/>
                    <div style={{flex:1, minWidth:0, marginLeft:8}}>
                      <div style={{fontSize:13, fontWeight:600}}>{schAttachment.name}</div>
                      <div style={{fontSize:11, color:'#64748b'}}>{(schAttachment.file.size/1024).toFixed(0)} KB</div>
                    </div>
                    <button type="button" className="wa-ibtn wa-ibtn--danger" onClick={()=>setSchAttachment(null)}><X size={13}/></button>
                  </div>
                ) : (
                  <button type="button" className="wa-input" style={{width:'100%', textAlign:'left', color:'#64748b'}} onClick={()=>schAttRef.current.click()}>
                    <Paperclip size={14} style={{marginRight:6}}/> Select Attachment
                  </button>
                )}
                <input ref={schAttRef} type="file" style={{display:'none'}} onChange={e=>{
                  const f = e.target.files[0];
                  if(f) setSchAttachment({file:f, name:f.name});
                }}/>
              </div>

              <button type="submit" className="wa-send-btn" disabled={schLoading} style={{justifyContent:'center'}}>
                <Play size={14}/> {schLoading ? 'Scheduling...' : 'Schedule Job'}
              </button>
              {schStatus && (
                <div style={{fontSize:12,padding:'8px 12px',borderRadius:6,background:schStatus.startsWith('✓')?'#f0fdf4':'#fef2f2',color:schStatus.startsWith('✓')?'#16a34a':'#dc2626',border:`1px solid ${schStatus.startsWith('✓')?'#bbf7d0':'#fecaca'}`}}>
                  {schStatus}
                </div>
              )}
            </form>
          </div>
          {/* Right: Queue */}
          <div className="wa-compose-panel">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div className="wa-section-title"><Timer size={13}/> Scheduled Queue</div>
              <button className="wa-ibtn" onClick={fetchSchJobs}><RefreshCw size={13}/></button>
            </div>
            {schJobs.length === 0 ? (
              <div className="wa-empty" style={{minHeight:160}}><Calendar size={32} opacity={0.15}/><p>No WhatsApp jobs scheduled</p></div>
            ) : schJobs.map(j => (
              <div key={j.id} style={{padding:'10px 14px',border:'1px solid #e2e8f0',borderRadius:8,marginBottom:8,background:'#f8fafc'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:'#0f172a'}}>
                      WhatsApp Batch
                      <span style={{marginLeft:8,padding:'2px 8px',borderRadius:20,fontSize:11,background:j.status==='pending'?'#fef3c7':j.status==='completed'?'#d1fae5':'#fee2e2',color:j.status==='pending'?'#92400e':j.status==='completed'?'#065f46':'#991b1b'}}>{j.status}</span>
                    </div>
                    <div style={{fontSize:11,color:'#64748b',marginTop:3}}>
                      <Clock size={10} style={{verticalAlign:'middle',marginRight:3}}/>
                      {new Date(j.target_datetime).toLocaleString()}
                    </div>
                  </div>
                  {j.status === 'pending' && (
                    <button className="wa-ibtn wa-ibtn--danger" onClick={()=>handleSchDelete(j.id)}><X size={13}/></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="wa-history-panel">
          <div className="wa-history-header">
            <div className="wa-section-title"><BarChart2 size={13} /> Campaign History</div>
            <button className="wa-ibtn" onClick={fetchCampaigns} title="Refresh"><RefreshCw size={14}/></button>
          </div>
          {campaigns.length === 0 ? (
            <div className="wa-empty"><BarChart2 size={40} opacity={0.15}/><p>No campaigns yet</p><span>Dispatch a campaign from the Compose tab!</span></div>
          ) : (
            campaigns.map(c => <CampaignCard key={c.id} c={c} onCancel={handleCancel} onDelete={handleDelete} />)
          )}
        </div>
      )}
    </div>

    {/* Toast */}
    {toast && (
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        padding: '12px 20px', borderRadius: 10,
        background: '#fff', border: '1px solid var(--border)',
        borderLeft: `4px solid ${toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--danger)' : 'var(--wa)'}`,
        boxShadow: 'var(--shadow-lg)',
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13.5, fontWeight: 600,
        color: toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--danger)' : 'var(--wa)',
        minWidth: 240, animation: 'scaleIn 0.2s ease-out'
      }}>
        {toast.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
        {toast.msg}
      </div>
    )}
    </>
  );
}
