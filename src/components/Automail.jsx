import { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud, Paperclip, Send, FileText, CheckCircle2,
  AlertCircle, Loader, ChevronDown, ChevronUp, X, Clock,
  Mail, Zap, BarChart2, RefreshCw, Calendar, Play, Timer
} from 'lucide-react';
import './Automail.css';

const API = import.meta.env.DEV ? 'http://localhost:8000' : '';

const fmtTime = (iso) => {
  if (!iso) return '';
  const s = iso.endsWith('Z') ? iso : iso + 'Z';
  return new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const statusColor = (s) => {
  if (s === 'completed') return '#10b981';
  if (s === 'running') return '#6366f1';
  if (s === 'failed') return '#ef4444';
  return '#64748b';
};

const ProgressBar = ({ value, max, color = '#6366f1' }) => {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="am-progress-track">
      <div className="am-progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
};

const CampaignCard = ({ campaign, onDismiss }) => {
  const [expanded, setExpanded] = useState(false);
  const sent = campaign.success;
  const failed = campaign.failed;
  const total = campaign.total;
  const remaining = total - sent - failed;
  const pct = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;
  const isRunning = campaign.status === 'running';

  return (
    <div className={`am-campaign-card ${campaign.status}`}>
      <div className="am-campaign-top">
        <div className="am-campaign-meta">
          <div className="am-campaign-badge" style={{ background: statusColor(campaign.status) + '22', color: statusColor(campaign.status) }}>
            {isRunning ? <Loader size={11} className="am-spin" /> : campaign.status === 'completed' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
            {isRunning ? 'Running' : campaign.status === 'completed' ? 'Completed' : 'Failed'}
          </div>
          <span className="am-campaign-subject" title={campaign.subject}>{campaign.subject}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button className="am-icon-btn" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {!isRunning && (
            <button className="am-icon-btn danger" onClick={() => onDismiss(campaign.id)}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="am-campaign-progress">
        <ProgressBar value={sent + failed} max={total} color={isRunning ? '#6366f1' : sent === total ? '#10b981' : '#f59e0b'} />
        <div className="am-progress-stats">
          <span className="am-stat-pill success"><CheckCircle2 size={10} /> {sent} sent</span>
          {failed > 0 && <span className="am-stat-pill error"><AlertCircle size={10} /> {failed} failed</span>}
          {isRunning && remaining > 0 && <span className="am-stat-pill pending"><Clock size={10} /> {remaining} pending</span>}
          <span className="am-stat-pill muted" style={{ marginLeft: 'auto' }}>{pct}%</span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="am-campaign-detail">
          <div className="am-detail-row"><span>From:</span><span>{campaign.from_email}</span></div>
          <div className="am-detail-row"><span>Started:</span><span>{fmtTime(campaign.started_at)}</span></div>
          <div className="am-detail-row"><span>Total Recipients:</span><span>{total}</span></div>
          {campaign.errors && campaign.errors.length > 0 && (
            <div className="am-detail-errors">
              <span className="am-errors-label"><AlertCircle size={12} /> Failed addresses:</span>
              {campaign.errors.slice(0, 5).map((e, i) => <span key={i} className="am-error-email">{e}</span>)}
              {campaign.errors.length > 5 && <span className="am-errors-label">+{campaign.errors.length - 5} more…</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function Automail() {
  const [csvFile, setCsvFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState([]);
  const [csvCount, setCsvCount] = useState(0);
  const [attachment, setAttachment] = useState(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const csvInputRef = useRef();
  const attInputRef = useRef();
  const pollRef    = useRef(null);
  const dismissedIds = useRef(new Set());
  const [toast, setToast] = useState(null);

  // ── Schedule state ──
  const [activeTab,    setActiveTab]    = useState('compose');
  const [schFile,      setSchFile]      = useState(null);
  const [schDate,      setSchDate]      = useState('');
  const [schTime,      setSchTime]      = useState('');
  const [schSubject,   setSchSubject]   = useState('');
  const [schMessage,   setSchMessage]   = useState('');
  const [schAttachment,setSchAttachment]= useState(null);
  const [schJobs,      setSchJobs]      = useState([]);
  const [schLoading,   setSchLoading]   = useState(false);
  const [schStatus,    setSchStatus]    = useState('');
  const schFileRef = useRef();
  const schAttRef  = useRef();

  const notify = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCampaigns = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/zoho/automail/status`).then(r => r.json());
      const all = (r.campaigns || []).filter(c => !dismissedIds.current.has(c.id));
      setCampaigns(all.slice().reverse());
    } catch { /* silent */ }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/zoho/connected-accounts`).then(r => r.json());
      const accs = r.accounts || [];
      setAccounts(accs);
      const defaultAcc = accs.find(a => a.isDefault);
      if (defaultAcc) setSelectedAccountId(defaultAcc.id);
      else if (accs.length > 0) setSelectedAccountId(accs[0].id);
    } catch { /* silent */ }
  }, []);

  // Start polling when there's a running campaign, stop when all done
  useEffect(() => {
    const hasRunning = campaigns.some(c => c.status === 'running');
    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(fetchCampaigns, 1500);
    } else if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {};
  }, [campaigns, fetchCampaigns]);

  // Fetch on mount
  useEffect(() => { fetchCampaigns(); fetchAccounts(); }, [fetchCampaigns, fetchAccounts]);

  const parseCsvPreview = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.trim().split(/\r?\n/).filter(Boolean);
      if (lines.length === 0) return;
      
      // Better separator detection (comma or semicolon)
      const firstLine = lines[0];
      const sep = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
      
      const headers = firstLine.split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));
      const rows = lines.slice(1, 6).map(line =>
        line.split(sep).map(v => v.trim().replace(/^["']|["']$/g, ''))
      );
      
      setCsvHeaders(headers);
      setCsvPreviewRows(rows);
      setCsvCount(lines.length - 1);
      setShowPreview(true); // Always show when file is loaded
    };
    reader.readAsText(file);
  };

  const handleCsvDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) { setCsvFile(f); parseCsvPreview(f); }
  };

  const handleCsvChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setCsvFile(f); parseCsvPreview(f); }
  };

  const insertPlaceholder = (col) => {
    setMessage(prev => prev + `{${col}}`);
  };

  const handleSend = async () => {
    if (!csvFile || !subject.trim() || !message.trim()) {
      notify('Please fill in all fields: CSV file, Subject, and Message.', 'error');
      return;
    }
    setIsSending(true);
    const formData = new FormData();
    formData.append('csv_file', csvFile);
    if (attachment) formData.append('attachment', attachment);
    formData.append('subject', subject);
    formData.append('message', message);
    if (selectedAccountId) formData.append('account_id', selectedAccountId);

    try {
      const resp = await fetch(`${API}/api/zoho/automail/bulk`, { method: 'POST', body: formData });
      const data = await resp.json();
      if (resp.ok) {
        // Reset form
        setCsvFile(null); setCsvHeaders([]); setCsvPreviewRows([]); setCsvCount(0);
        setAttachment(null); setSubject(''); setMessage('');
        notify('Campaign dispatched! Tracking in the panel →', 'success');
        // Immediately add campaign to list and start polling
        await fetchCampaigns();
        if (!pollRef.current) {
          pollRef.current = setInterval(fetchCampaigns, 1500);
        }
      } else {
        notify(data.detail || 'Unknown error starting campaign.', 'error');
      }
    } catch (err) {
      notify(`Server connection error: ${err.message}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const dismissCampaign = (id) => {
    dismissedIds.current.add(id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  const runningCampaigns = campaigns.filter(c => c.status === 'running');
  const completedCampaigns = campaigns.filter(c => c.status !== 'running');

  const fetchSchJobs = async () => {
    try {
      const r = await fetch(`${API}/api/schedule`);
      if (r.ok) { const d = await r.json(); setSchJobs(d.jobs?.filter(j => j.type === 'email') || []); }
    } catch {}
  };

  const handleSchSubmit = async (e) => {
    e.preventDefault();
    if (!schFile || !schDate || !schTime || !schSubject.trim() || !schMessage.trim()) {
      setSchStatus('Please fill all fields.'); return;
    }
    setSchLoading(true); setSchStatus('Scheduling...');
    const fd = new FormData();
    fd.append('csv_file', schFile);
    fd.append('type', 'email');
    fd.append('target_datetime', `${schDate}T${schTime}`);
    fd.append('subject', schSubject);
    fd.append('message', schMessage);
    if (selectedAccountId) fd.append('account_id', selectedAccountId);
    if (schAttachment) fd.append('attachment', schAttachment);
    try {
      const r = await fetch(`${API}/api/schedule`, { method: 'POST', body: fd });
      const d = await r.json();
      if (r.ok) {
        setSchStatus(`✓ Scheduled! Job ID: ${d.job_id}`);
        setSchFile(null); setSchSubject(''); setSchMessage(''); setSchDate(''); setSchTime(''); setSchAttachment(null);
        setCsvHeaders([]); setCsvPreviewRows([]);
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
    <div className="am-root">
      <div className="am-header">
        <div>
          <h1 className="am-title"><Zap size={22} /> AutoMail Engine</h1>
          <p className="am-subtitle">Bulk personalized email campaigns with live progress tracking</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {/* Tab switcher */}
          <div style={{display:'flex',border:'1px solid #e2e8f0',borderRadius:8,overflow:'hidden'}}>
            <button onClick={()=>setActiveTab('compose')} style={{padding:'6px 14px',fontSize:12,fontWeight:600,background:activeTab==='compose'?'#6366f1':'transparent',color:activeTab==='compose'?'#fff':'#64748b',border:'none',cursor:'pointer'}}>Compose</button>
            <button onClick={()=>{setActiveTab('schedule');fetchSchJobs();}} style={{padding:'6px 14px',fontSize:12,fontWeight:600,background:activeTab==='schedule'?'#6366f1':'transparent',color:activeTab==='schedule'?'#fff':'#64748b',border:'none',borderLeft:'1px solid #e2e8f0',cursor:'pointer'}}><Calendar size={12} style={{verticalAlign:'middle',marginRight:4}}/>Schedule</button>
          </div>
          <button className="am-refresh-btn" onClick={fetchCampaigns} title="Refresh campaigns">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {activeTab === 'compose' && (
      <div className="am-layout">
        {/* ── LEFT: Compose ── */}
        <div className="am-compose-panel">
          <div className="am-section-title">0 · Send From</div>
          <select 
            className="am-input" 
            value={selectedAccountId} 
            onChange={e => setSelectedAccountId(e.target.value)}
            disabled={accounts.length === 0}
            style={{ marginBottom: 12, cursor: 'pointer' }}
          >
            {accounts.length === 0 ? <option value="">No connected accounts</option> : null}
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.displayName || acc.email} ({acc.email})
              </option>
            ))}
          </select>

          <div className="am-section-title">1 · Recipients CSV</div>
          <div
            className={`am-drop-zone ${isDragging ? 'dragging' : ''} ${csvFile ? 'has-file' : ''}`}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleCsvDrop}
            onClick={() => csvInputRef.current.click()}
            style={csvFile ? { padding: '8px 12px' } : {}}
          >
            <input ref={csvInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleCsvChange} />
            {csvFile ? (
              <div className="am-file-info">
                <FileText size={20} className="am-file-icon" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="am-file-name" style={{ fontSize: 13 }}>{csvFile.name}</div>
                  <div className="am-file-meta" style={{ fontSize: 11 }}>{csvCount} recipients detected</div>
                </div>
                <button className="am-icon-btn danger" onClick={e => { e.stopPropagation(); setCsvFile(null); setCsvHeaders([]); setCsvPreviewRows([]); setCsvCount(0); }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <>
                <UploadCloud size={24} className="am-drop-icon" />
                <div className="am-drop-text" style={{ fontSize: 13 }}>Click to upload CSV / Excel</div>
                <div className="am-drop-hint" style={{ fontSize: 11 }}>Must include <strong>Email</strong> column</div>
              </>
            )}
          </div>

          {/* CSV Preview Table */}
          {csvHeaders.length > 0 && (
            <div className="am-csv-preview" style={{ 
              background: '#fff', 
              padding: '10px', 
              borderRadius: 8, 
              border: '2px solid var(--auto)', 
              boxShadow: '0 4px 12px rgba(245,158,11,0.1)'
            }}>
              <div className="am-section-title" style={{ fontSize: 11, marginBottom: 8, color: 'var(--auto-deep)' }}>
                <FileText size={12} /> Data Preview (First 5 rows)
              </div>
              
              <div className="am-table-wrap" style={{ maxHeight: 120, border: '1px solid #eee' }}>
                <table className="am-table" style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8f9fa' }}>
                      {csvHeaders.map(h => (
                        <th key={h} style={{ padding: '6px 10px', borderBottom: '2px solid #ddd', borderRight: '1px solid #eee', textAlign: 'left' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreviewRows.map((row, i) => (
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

              <div className="am-section-title" style={{ marginTop: 10, marginBottom: 6, fontSize: 11 }}>Click to insert variable:</div>
              <div className="am-col-chips">
                {csvHeaders.map(h => (
                  <button key={h} className="am-col-chip" onClick={() => insertPlaceholder(h)} style={{ padding: '4px 8px', fontSize: 11 }}>{`{${h}}`}</button>
                ))}
              </div>
            </div>
          )}

          <div className="am-section-title">2 · Subject Line</div>
          <input
            className="am-input"
            placeholder="e.g.  Important update for {Name} regarding {Company}..."
            value={subject}
            onChange={e => setSubject(e.target.value)}
          />

          <div className="am-section-title">3 · Message Body</div>
          <textarea
            className="am-input am-textarea"
            placeholder={"Hello {Name},\n\nHere is your personalized update...\n\nBest regards,\nCEO Office"}
            value={message}
            onChange={e => setMessage(e.target.value)}
          />

          <div className="am-section-title">4 · Attachment <span className="am-optional">(optional)</span></div>
          <div className="am-attachment-row">
            <button className="am-attach-btn" onClick={() => attInputRef.current.click()}>
              <Paperclip size={15} /> {attachment ? attachment.name : 'Select Attachment'}
            </button>
            {attachment && (
              <button className="am-icon-btn danger" onClick={() => setAttachment(null)}><X size={14} /></button>
            )}
            <input ref={attInputRef} type="file" style={{ display: 'none' }} onChange={e => setAttachment(e.target.files?.[0] || null)} />
          </div>

          <button className="am-send-btn" onClick={handleSend} disabled={isSending || !csvFile || !subject || !message}>
            {isSending
              ? <><Loader size={18} className="am-spin" /> Dispatching…</>
              : <><Send size={18} /> Dispatch Campaign ({csvCount || 0} recipients)</>
            }
          </button>
        </div>

        {/* ── RIGHT: Campaigns Panel ── */}
        <div className="am-campaigns-panel">
          {/* Live preview */}
          <div className="am-preview-card">
            <div className="am-section-title"><Mail size={13} /> Email Preview</div>
            <div className="am-preview-subject">{subject || 'Your subject line will appear here…'}</div>
            <div className="am-preview-body">{message || 'Your personalized message body will appear here…'}</div>
          </div>

          {/* Running campaigns */}
          {runningCampaigns.length > 0 && (
            <div>
              <div className="am-section-title"><BarChart2 size={13} /> Active Campaigns</div>
              {runningCampaigns.map(c => (
                <CampaignCard key={c.id} campaign={c} onDismiss={dismissCampaign} />
              ))}
            </div>
          )}

          {/* Completed campaigns */}
          {completedCampaigns.length > 0 && (
            <div>
              <div className="am-section-title" style={{ marginTop: 8 }}><CheckCircle2 size={13} /> Campaign History</div>
              {completedCampaigns.map(c => (
                <CampaignCard key={c.id} campaign={c} onDismiss={dismissCampaign} />
              ))}
            </div>
          )}

          {campaigns.length === 0 && (
            <div className="am-empty-state">
              <BarChart2 size={40} opacity={0.2} />
              <p>No campaigns dispatched yet.</p>
              <span>Fill in the form and hit Dispatch!</span>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── SCHEDULE TAB ── */}
      {activeTab === 'schedule' && (
        <div className="am-layout">
          <div className="am-compose-panel">
            <div className="am-section-title"><Calendar size={13}/> Schedule Email Batch</div>
            <form onSubmit={handleSchSubmit} style={{display:'flex',flexDirection:'column',gap:12,marginTop:8}}>
              <div className="am-section-title">Send From</div>
              <select className="am-input" value={selectedAccountId} onChange={e=>setSelectedAccountId(e.target.value)} disabled={accounts.length===0}>
                {accounts.length===0?<option value="">No accounts connected</option>:null}
                {accounts.map(a=><option key={a.id} value={a.id}>{a.displayName||a.email}</option>)}
              </select>
              <div>
                <label style={{fontSize:12,fontWeight:500,color:'#64748b',display:'block',marginBottom:4}}>1 · Upload Batch CSV</label>
                <div
                  className={`am-drop-zone ${isDragging ? 'dragging' : ''} ${schFile ? 'has-file' : ''}`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault(); setIsDragging(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) { setSchFile(f); parseCsvPreview(f); }
                  }}
                  onClick={() => schFileRef.current.click()}
                  style={schFile ? { padding: '8px 12px' } : {}}
                >
                  <input ref={schFileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setSchFile(f); parseCsvPreview(f); } }} />
                  {schFile ? (
                    <div className="am-file-info">
                      <FileText size={20} className="am-file-icon" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="am-file-name" style={{ fontSize: 13 }}>{schFile.name}</div>
                        <div className="am-file-meta" style={{ fontSize: 11 }}>Ready to schedule</div>
                      </div>
                      <button type="button" className="am-icon-btn danger" onClick={(e) => { e.stopPropagation(); setSchFile(null); setCsvHeaders([]); setCsvPreviewRows([]); }}><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <UploadCloud size={24} className="am-drop-icon" />
                      <div className="am-drop-text" style={{ fontSize: 13 }}>Click to upload CSV / Excel</div>
                    </>
                  )}
                </div>
              </div>

              {/* CSV Preview Table */}
              {schFile && csvHeaders.length > 0 && (
                <div className="am-csv-preview" style={{ 
                  background: '#fff', padding: '10px', borderRadius: 8, border: '2px solid var(--auto)', boxShadow: '0 4px 12px rgba(245,158,11,0.1)'
                }}>
                  <div className="am-section-title" style={{ fontSize: 11, marginBottom: 8, color: 'var(--auto-deep)' }}><FileText size={12} /> Data Preview</div>
                  <div className="am-table-wrap" style={{ maxHeight: 120, border: '1px solid #eee' }}>
                    <table className="am-table" style={{ fontSize: 11, width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr style={{ background: '#f8f9fa' }}>{csvHeaders.map(h => <th key={h} style={{ padding: '6px 10px', borderBottom: '2px solid #ddd', textAlign: 'left' }}>{h}</th>)}</tr></thead>
                      <tbody>{csvPreviewRows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} style={{ padding: '6px 10px', borderBottom: '1px solid #eee', color: '#444' }}>{cell}</td>)}</tr>)}</tbody>
                    </table>
                  </div>
                  <div className="am-section-title" style={{ marginTop: 10, marginBottom: 6, fontSize: 11 }}>Click to insert variable:</div>
                  <div className="am-col-chips">
                    {csvHeaders.map(h => <button type="button" key={h} className="am-col-chip" onClick={() => setSchMessage(prev => prev + `{${h}}`)} style={{ padding: '4px 8px', fontSize: 11 }}>{`{${h}}`}</button>)}
                  </div>
                </div>
              )}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <div>
                  <label style={{fontSize:12,fontWeight:500,color:'#64748b',display:'block',marginBottom:4}}><Calendar size={12} style={{verticalAlign:'middle'}}/> Date</label>
                  <input type="date" className="am-input" value={schDate} onChange={e=>setSchDate(e.target.value)} required />
                </div>
                <div>
                  <label style={{fontSize:12,fontWeight:500,color:'#64748b',display:'block',marginBottom:4}}><Clock size={12} style={{verticalAlign:'middle'}}/> Time</label>
                  <input type="time" className="am-input" value={schTime} onChange={e=>setSchTime(e.target.value)} required />
                </div>
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:500,color:'#64748b',display:'block',marginBottom:4}}>Subject</label>
                <input type="text" className="am-input" placeholder="Email subject..." value={schSubject} onChange={e=>setSchSubject(e.target.value)} required />
              </div>
              <div>
                <label style={{fontSize:12,fontWeight:500,color:'#64748b',display:'block',marginBottom:4}}>Message Body</label>
                <textarea className="am-input am-textarea" rows={4} placeholder="Your message... use {ColumnName} to personalize" value={schMessage} onChange={e=>setSchMessage(e.target.value)} required />
              </div>

              {/* Attachment */}
              <div>
                <label style={{fontSize:12,fontWeight:500,color:'#64748b',display:'block',marginBottom:4}}>Attachment (optional)</label>
                {schAttachment ? (
                  <div style={{display:'flex', alignItems:'center', gap:8, padding:'8px 12px', border:'1px solid #e2e8f0', borderRadius:8}}>
                    <Paperclip size={16} color="#6366f1"/>
                    <span style={{fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{schAttachment.name}</span>
                    <button type="button" className="am-icon-btn danger" onClick={()=>setSchAttachment(null)}><X size={14}/></button>
                  </div>
                ) : (
                  <button type="button" className="am-input" style={{textAlign:'left', color:'#64748b'}} onClick={()=>schAttRef.current.click()}>
                    <Paperclip size={14} style={{marginRight:6}}/> Select Attachment
                  </button>
                )}
                <input ref={schAttRef} type="file" style={{display:'none'}} onChange={e=>setSchAttachment(e.target.files[0])}/>
              </div>

              <button type="submit" className="am-send-btn" disabled={schLoading} style={{justifyContent:'center'}}>
                <Play size={14}/> {schLoading ? 'Scheduling...' : 'Schedule Email Job'}
              </button>
              {schStatus && (
                <div style={{fontSize:12,padding:'8px 12px',borderRadius:6,background:schStatus.startsWith('✓')?'#f0fdf4':'#fef2f2',color:schStatus.startsWith('✓')?'#16a34a':'#dc2626',border:`1px solid ${schStatus.startsWith('✓')?'#bbf7d0':'#fecaca'}`}}>
                  {schStatus}
                </div>
              )}
            </form>
          </div>
          <div className="am-campaigns-panel">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <div className="am-section-title"><Timer size={13}/> Email Job Queue</div>
              <button className="am-refresh-btn" onClick={fetchSchJobs}><RefreshCw size={13}/></button>
            </div>
            {schJobs.length === 0 ? (
              <div className="am-empty-state" style={{minHeight:180}}><Calendar size={40} opacity={0.15}/><p>No email jobs scheduled</p><span>Schedule a batch above!</span></div>
            ) : schJobs.map(j => (
              <div key={j.id} style={{padding:'10px 14px',border:'1px solid #e2e8f0',borderRadius:8,marginBottom:8,background:'#f8fafc'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:600,fontSize:13,color:'#0f172a'}}>
                      Email Batch
                      <span style={{marginLeft:8,padding:'2px 8px',borderRadius:20,fontSize:11,background:j.status==='pending'?'#fef3c7':j.status==='completed'?'#d1fae5':'#fee2e2',color:j.status==='pending'?'#92400e':j.status==='completed'?'#065f46':'#991b1b'}}>{j.status}</span>
                    </div>
                    <div style={{fontSize:11,color:'#64748b',marginTop:3}}><Clock size={10} style={{verticalAlign:'middle',marginRight:3}}/>{new Date(j.target_datetime).toLocaleString()}</div>
                    {j.subject && <div style={{fontSize:11,color:'#94a3b8',marginTop:2}}>Subject: {j.subject}</div>}
                  </div>
                  {j.status === 'pending' && <button className="am-icon-btn danger" onClick={()=>handleSchDelete(j.id)}><X size={13}/></button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>

    {/* Toast notification */}
    {toast && (
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        padding: '12px 20px', borderRadius: 10,
        background: '#fff', border: '1px solid var(--border)',
        borderLeft: `4px solid ${toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--danger)' : 'var(--auto)'}`,
        boxShadow: 'var(--shadow-lg)',
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13.5, fontWeight: 600,
        color: toast.type === 'success' ? 'var(--success)' : toast.type === 'error' ? 'var(--danger)' : 'var(--auto)',
        minWidth: 240, animation: 'scaleIn 0.2s ease-out'
      }}>
        {toast.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
        {toast.message}
      </div>
    )}
    </>
  );
}
