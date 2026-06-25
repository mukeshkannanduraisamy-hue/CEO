import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Inbox, Send, Trash2, Star, Tag, Folder, Search, Edit3,
  RefreshCw, Reply, Forward, Archive, AlertOctagon, X, Paperclip,
  Download, ChevronDown, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import './ZohoMail.css';

const API = import.meta.env.DEV ? 'http://localhost:8000' : '';

const FOLDER_ICONS = { inbox: Inbox, sent: Send, trash: Trash2, drafts: Edit3, spam: AlertOctagon };
const folderIcon = (name) => {
  const n = name.toLowerCase();
  for (const [k, V] of Object.entries(FOLDER_ICONS)) if (n.includes(k)) return <V size={15}/>;
  return <Folder size={15}/>;
};

const avatar = (name) => (name || '?').charAt(0).toUpperCase();
const decodeHTML = (str) => {
  if (!str) return '';
  return str.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');
};
const fmtDate = (ts) => {
  if (!ts) return '';
  const d = new Date(parseInt(ts));
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString([], {month:'short',day:'numeric'});
};

export default function ZohoMail() {
  const [folders, setFolders] = useState([]);
  const [labels, setLabels] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [emails, setEmails] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [detail, setDetail] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [compose, setCompose] = useState(null); // null | {mode,to,cc,bcc,subject,content,inReplyTo,attachments}
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [moveMenu, setMoveMenu] = useState(false);
  const [labelMenu, setLabelMenu] = useState(false);
  const [composeAttachment, setComposeAttachment] = useState(null);
  const composeFileRef = useRef();
  const [connectedAccounts, setConnectedAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [previewAttachment, setPreviewAttachment] = useState(null);

  const [pageStart, setPageStart] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = useCallback(async () => {
    try {
      const [foldR, labR, sigR, accsR] = await Promise.all([
        fetch(`${API}/api/zoho/folders`).then(r => r.json()),
        fetch(`${API}/api/zoho/labels`).then(r => r.json()),
        fetch(`${API}/api/zoho/signatures`).then(r => r.json()),
        fetch(`${API}/api/zoho/connected-accounts`).then(r => r.json()),
      ]);
      const fl = foldR.data || [];
      setFolders(fl);
      setLabels(labR.data || []);
      setSignatures(sigR.data || []);
      const accs = accsR.accounts || [];
      setConnectedAccounts(accs);
      setSelectedAccountId(prev => {
        if (!prev && accs.length > 0) {
          const def = accs.find(a => a.isDefault) || accs[0];
          return def.id;
        }
        return prev;
      });
      const inbox = fl.find(f => f.folderName.toLowerCase() === 'inbox') || fl[0];
      if (inbox) { setSelectedFolder(inbox); fetchEmails(inbox.folderId, null, true); }
    } catch { notify('Failed to load account data', 'error'); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const switchAccount = async (accountId) => {
    setSelectedAccountId(accountId);
    // Set as default on backend
    await fetch(`${API}/api/zoho/connected-accounts/${accountId}/default`, { method: 'PUT' });
    // Reload everything for new account
    setEmails([]); setSelectedEmail(null); setDetail(null);
    setFolders([]); setLabels([]);
    try {
      const [foldR, labR] = await Promise.all([
        fetch(`${API}/api/zoho/folders`).then(r => r.json()),
        fetch(`${API}/api/zoho/labels`).then(r => r.json()),
      ]);
      const fl = foldR.data || [];
      setFolders(fl);
      setLabels(labR.data || []);
      const inbox = fl.find(f => f.folderName.toLowerCase() === 'inbox') || fl[0];
      if (inbox) { setSelectedFolder(inbox); fetchEmails(inbox.folderId, null, true, accountId); }
    } catch { notify('Failed to switch account', 'error'); }
  };

  async function fetchEmails(folderId, labelId = null, reset = true, accId = null) {
    setIsLoadingList(true);
    if (reset) {
      setPageStart(1);
      setEmails([]);
      setSelectedEmail(null); setDetail(null);
    }
    
    const currentStart = reset ? 1 : pageStart;
    const currentAccId = accId || selectedAccountId;
    try {
      let url = `${API}/api/zoho/mail?limit=50&start=${currentStart}`;
      if (folderId) url += `&folder_id=${folderId}`;
      if (labelId) url += `&label_id=${labelId}`;
      if (currentAccId) url += `&account_id=${currentAccId}`;
      const r = await fetch(url).then(r => r.json());
      const newEmails = r.emails || [];
      
      setEmails(prev => reset ? newEmails : [...prev, ...newEmails]);
      setHasMore(newEmails.length === 50);
      setPageStart(currentStart + 50);
    } catch { notify('Failed to fetch emails', 'error'); }
    finally { setIsLoadingList(false); }
  }

  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsLoadingList(true);
    setSelectedFolder(null); setSelectedLabel(null);
    try {
      let url = `${API}/api/zoho/search?search_key=${encodeURIComponent(searchQuery)}`;
      if (selectedAccountId) url += `&account_id=${selectedAccountId}`;
      const r = await fetch(url).then(r => r.json());
      setEmails(r.emails || []);
      setHasMore(false);
      setPageStart(1);
    } catch { notify('Search failed', 'error'); }
    finally { setIsLoadingList(false); }
  };

  const openEmail = async (email) => {
    setSelectedEmail(email);
    setDetail(null); setIsLoadingDetail(true);
    try {
      let fParam = `?account_id=${selectedAccountId || ''}`;
      if (email.folderId) fParam += `&folder_id=${email.folderId}`;
      const r = await fetch(`${API}/api/zoho/mail/${email.messageId}${fParam}`).then(r => r.json());
      const d = r.data || {};
      setDetail({ ...d, folderId: d.folderId || email.folderId });
      // Mark as read
      if (!email.isRead) {
        updateMessages([email.messageId], 'markAsRead');
        setEmails(prev => prev.map(e => e.messageId === email.messageId ? {...e, isRead: true} : e));
      }
    } catch { notify('Failed to load email', 'error'); }
    finally { setIsLoadingDetail(false); }
  };

  const updateMessages = async (ids, mode, folderId = null) => {
    try {
      const body = { messageIds: ids, mode };
      if (folderId) body.folderId = folderId;
      await fetch(`${API}/api/zoho/mail/update`, {
        method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
      });
    } catch { notify('Action failed', 'error'); }
  };

  const deleteEmail = async (messageId) => {
    try {
      await fetch(`${API}/api/zoho/mail/${messageId}`, { method: 'DELETE' });
      setEmails(prev => prev.filter(e => e.messageId !== messageId));
      if (selectedEmail?.messageId === messageId) { setSelectedEmail(null); setDetail(null); }
      notify('Email deleted');
    } catch { notify('Delete failed', 'error'); }
  };

  const toggleStar = async (email) => {
    const mode = email.isFlagged ? 'unflagMessage' : 'flagMessage';
    await updateMessages([email.messageId], mode);
    setEmails(prev => prev.map(e => e.messageId === email.messageId ? {...e, isFlagged: !e.isFlagged} : e));
  };

  const markRead = async (email, read) => {
    await updateMessages([email.messageId], read ? 'markAsRead' : 'markAsUnRead');
    setEmails(prev => prev.map(e => e.messageId === email.messageId ? {...e, isRead: read} : e));
  };

  const moveEmail = async (messageId, targetFolderId) => {
    await updateMessages([messageId], 'moveMessage', targetFolderId);
    setEmails(prev => prev.filter(e => e.messageId !== messageId));
    if (selectedEmail?.messageId === messageId) { setSelectedEmail(null); setDetail(null); }
    setMoveMenu(false);
    notify('Email moved');
  };

  const markSpam = async (messageId) => {
    await updateMessages([messageId], 'markAsSpam');
    setEmails(prev => prev.filter(e => e.messageId !== messageId));
    if (selectedEmail?.messageId === messageId) { setSelectedEmail(null); setDetail(null); }
    notify('Marked as spam');
  };

  const addLabel = async (messageId, tagId, folderId) => {
    try {
      await fetch(`${API}/api/zoho/mail/${messageId}/label?folder_id=${folderId || ''}`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({tagId})
      });
      setLabelMenu(false);
      notify('Label applied');
    } catch { notify('Failed to apply label', 'error'); }
  };

  const openCompose = (mode = 'new', email = null, det = null) => {
    const sig = signatures[0]?.content || '';
    let to = '', subject = '', content = `<br><br><hr>${sig}`, inReplyTo = null;
    if (mode === 'reply' && email) {
      to = email.fromAddress || email.senderEmail || '';
      subject = `Re: ${email.subject || ''}`;
      content = `<br><br><blockquote style="border-left:3px solid #6366f1;padding-left:12px;color:#94a3b8;">${det?.content || ''}</blockquote><br>${sig}`;
      inReplyTo = email.messageId;
    } else if (mode === 'forward' && email) {
      subject = `Fwd: ${email.subject || ''}`;
      content = `<br><br>---------- Forwarded message ----------<br>From: ${email.fromAddress}<br><br>${det?.content || ''}<br>${sig}`;
      inReplyTo = email.messageId;
    }
    setCompose({ mode, to, cc: '', bcc: '', subject, content, inReplyTo, attachments: [] });
  };

  const sendEmail = async () => {
    if (!compose.to || !compose.subject) { notify('To and Subject are required', 'error'); return; }
    try {
      let uploadedAtt = [];
      if (composeAttachment) {
        const fd = new FormData();
        fd.append('file', composeAttachment);
        const r = await fetch(`${API}/api/zoho/mail/attachments`, { method:'POST', body: fd }).then(r => r.json());
        if (r.data) uploadedAtt = Array.isArray(r.data) ? r.data : [r.data];
      }

      const endpoint = compose.inReplyTo ? `${API}/api/zoho/mail/reply` : `${API}/api/zoho/mail/send`;
      const body = compose.inReplyTo
        ? { messageId: compose.inReplyTo, toAddress: compose.to, ccAddress: compose.cc, subject: compose.subject, content: compose.content, isForward: compose.mode === 'forward', attachments: uploadedAtt.length ? uploadedAtt : undefined }
        : { toAddress: compose.to, ccAddress: compose.cc, bccAddress: compose.bcc, subject: compose.subject, content: compose.content, attachments: uploadedAtt.length ? uploadedAtt : undefined };

      const r = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }).then(r => r.json());
      if (r.status === 'success') {
        notify('Email sent ✓'); setCompose(null); setComposeAttachment(null);
      } else { notify('Send failed', 'error'); }
    } catch (e) { notify(`Error: ${e.message}`, 'error'); }
  };

  const saveDraft = async () => {
    try {
      await fetch(`${API}/api/zoho/mail/draft`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ toAddress: compose.to, subject: compose.subject, content: compose.content })
      });
      notify('Draft saved'); setCompose(null);
    } catch { notify('Draft save failed', 'error'); }
  };

  return (
    <div className="zm-root">
      {/* Sidebar */}
      <aside className="zm-sidebar">
        {connectedAccounts.length > 0 && (
          <div className="zm-account-switcher">
            <select value={selectedAccountId || ''} onChange={e => switchAccount(e.target.value)}>
              {connectedAccounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.displayName || acc.email}</option>
              ))}
            </select>
          </div>
        )}
        <button className="zm-compose-btn" onClick={() => openCompose()}>
          <Edit3 size={16}/> Compose
        </button>

        <div className="zm-sidebar-section">
          <div className="zm-sidebar-label">Folders</div>
          {folders.map(f => (
            <div key={f.folderId}
              className={`zm-folder-item ${selectedFolder?.folderId === f.folderId && !selectedLabel ? 'active' : ''}`}
              onClick={() => { setSelectedFolder(f); setSelectedLabel(null); setSearchQuery(''); fetchEmails(f.folderId, null, true); }}>
              {folderIcon(f.folderName)}
              <span>{f.folderName}</span>
              {f.unreadCount > 0 && <span className="zm-badge">{f.unreadCount}</span>}
            </div>
          ))}
        </div>

        {labels.length > 0 && (
          <div className="zm-sidebar-section">
            <div className="zm-sidebar-label">Labels</div>
            {labels.map(l => (
              <div key={l.tagId}
                className={`zm-folder-item ${selectedLabel?.tagId === l.tagId ? 'active' : ''}`}
                onClick={() => { setSelectedLabel(l); setSelectedFolder(null); fetchEmails(null, l.tagId, true); }}>
                <span className="zm-label-dot" style={{background: l.color || '#6366f1'}}/>
                <span>{l.tagName}</span>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Email List */}
      <section className="zm-list">
        <div className="zm-list-header">
          <div className="zm-search-bar">
            <Search size={15}/>
            <input placeholder="Search mail…" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}/>
          </div>
          <button className="zm-icon-btn" title="Refresh"
            onClick={() => selectedFolder ? fetchEmails(selectedFolder.folderId, null, true) : null}>
            <RefreshCw size={16} className={isLoadingList ? 'spinning' : ''} />
          </button>
        </div>

        <div className="zm-list-title">
          {selectedLabel ? selectedLabel.tagName : selectedFolder?.folderName || 'Search Results'}
          <span className="zm-list-count">{emails.length}</span>
        </div>

        <div className="zm-email-list">
          {isLoadingList && emails.length === 0 ? (
            [1,2,3,4,5].map(i => <div key={i} className="zm-skeleton"/>)
          ) : emails.length === 0 ? (
            <div className="zm-empty"><Mail size={40}/><p>No emails here</p></div>
          ) : (
            <>
              {emails.map(email => (
                <div key={email.messageId}
                  className={`zm-email-row ${!email.isRead ? 'unread' : ''} ${selectedEmail?.messageId === email.messageId ? 'selected' : ''}`}
                  onClick={() => openEmail(email)}>
                  <div className="zm-row-left">
                    <div className="zm-avatar">{avatar(email.senderName || email.fromAddress)}</div>
                  </div>
                  <div className="zm-row-body">
                    <div className="zm-row-top">
                      <span className="zm-row-sender">{email.senderName || email.fromAddress}</span>
                      <span className="zm-row-date">{fmtDate(email.receivedTime)}</span>
                    </div>
                    <div className="zm-row-subject">{email.subject || '(No Subject)'}</div>
                    <div className="zm-row-snippet">{decodeHTML(email.summary)}</div>
                  </div>
                  <div className="zm-row-actions">
                    <button className={`zm-icon-btn star ${email.isFlagged ? 'starred' : ''}`}
                      onClick={e => { e.stopPropagation(); toggleStar(email); }}>
                      <Star size={14} fill={email.isFlagged ? 'currentColor' : 'none'}/>
                    </button>
                    <button className="zm-icon-btn danger"
                      onClick={e => { e.stopPropagation(); deleteEmail(email.messageId); }}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              ))}
              
              {hasMore && !isLoadingList && (
                <div style={{padding: '16px', display: 'flex', justifyContent: 'center'}}>
                  <button className="zm-icon-btn" style={{padding: '8px 16px', background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)'}}
                    onClick={() => fetchEmails(selectedFolder?.folderId, selectedLabel?.tagId, false)}>
                    Load More Emails
                  </button>
                </div>
              )}
              {isLoadingList && emails.length > 0 && (
                <div style={{padding: '16px', display: 'flex', justifyContent: 'center'}}>
                  <Loader size={20} className="spinning" color="#64748b"/>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Email Detail */}
      <section className="zm-detail">
        {!selectedEmail ? (
          <div className="zm-detail-empty">
            <Mail size={64} opacity={0.15}/>
            <h3>Select an email to read</h3>
            <p>Or compose a new message</p>
          </div>
        ) : (
          <div className="zm-detail-view">
            {/* Toolbar */}
            <div className="zm-detail-toolbar">
              <button className="zm-icon-btn" title="Reply" onClick={() => openCompose('reply', selectedEmail, detail)}>
                <Reply size={16}/>
              </button>
              <button className="zm-icon-btn" title="Forward" onClick={() => openCompose('forward', selectedEmail, detail)}>
                <Forward size={16}/>
              </button>
              <button className={`zm-icon-btn ${selectedEmail.isFlagged ? 'starred' : ''}`} title="Star"
                onClick={() => { toggleStar(selectedEmail); setSelectedEmail(e => ({...e, isFlagged: !e.isFlagged})); }}>
                <Star size={16} fill={selectedEmail.isFlagged ? 'currentColor' : 'none'}/>
              </button>
              <button className="zm-icon-btn" title={selectedEmail.isRead ? 'Mark Unread' : 'Mark Read'}
                onClick={() => markRead(selectedEmail, !selectedEmail.isRead)}>
                <Mail size={16}/>
              </button>

              {/* Move dropdown */}
              <div className="zm-dropdown-wrap">
                <button className="zm-icon-btn" title="Move" onClick={() => setMoveMenu(v => !v)}>
                  <Archive size={16}/> <ChevronDown size={12}/>
                </button>
                {moveMenu && (
                  <div className="zm-dropdown">
                    {folders.map(f => (
                      <div key={f.folderId} className="zm-dropdown-item"
                        onClick={() => moveEmail(selectedEmail.messageId, f.folderId)}>
                        {folderIcon(f.folderName)} {f.folderName}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Label dropdown */}
              {labels.length > 0 && (
                <div className="zm-dropdown-wrap">
                  <button className="zm-icon-btn" title="Label" onClick={() => setLabelMenu(v => !v)}>
                    <Tag size={16}/> <ChevronDown size={12}/>
                  </button>
                  {labelMenu && (
                    <div className="zm-dropdown">
                      {labels.map(l => (
                        <div key={l.tagId} className="zm-dropdown-item"
                          onClick={() => addLabel(selectedEmail.messageId, l.tagId, detail?.folderId)}>
                          <span className="zm-label-dot" style={{background: l.color}}/> {l.tagName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button className="zm-icon-btn danger" title="Spam" onClick={() => markSpam(selectedEmail.messageId)}>
                <AlertOctagon size={16}/>
              </button>
              <button className="zm-icon-btn danger" title="Delete" onClick={() => deleteEmail(selectedEmail.messageId)}>
                <Trash2 size={16}/>
              </button>
            </div>

            {/* Header */}
            <div className="zm-detail-header">
              <div className="zm-detail-avatar">{avatar(selectedEmail.senderName)}</div>
              <div className="zm-detail-meta">
                <h2 className="zm-detail-subject">{selectedEmail.subject || '(No Subject)'}</h2>
                <div className="zm-detail-from">
                  <strong>{selectedEmail.senderName}</strong>
                  <span>&lt;{selectedEmail.fromAddress}&gt;</span>
                  <span className="zm-detail-time">{fmtDate(selectedEmail.receivedTime)}</span>
                </div>
              </div>
            </div>

            {/* Attachments */}
            {detail?.attachments?.length > 0 && (
              <div className="zm-attachments">
                <div className="zm-att-title"><Paperclip size={14}/> {detail.attachments.length} attachment{detail.attachments.length > 1 ? 's' : ''}</div>
                <div className="zm-att-list">
                  {detail.attachments.map((att, i) => (
                    <button key={i} className="zm-att-chip"
                      onClick={() => setPreviewAttachment(att)}>
                      <Paperclip size={12}/> {att.attachmentName}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Body */}
            <div className="zm-detail-body">
              {isLoadingDetail ? (
                <div className="zm-loading-body"><Loader size={24} className="spinning"/></div>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: detail?.content || selectedEmail.summary || '' }}/>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Compose Modal */}
      {compose && (
        <div className="zm-compose-modal">
          <div className="zm-compose-header">
            <span>{compose.mode === 'reply' ? 'Reply' : compose.mode === 'forward' ? 'Forward' : 'New Message'}</span>
            <div style={{display:'flex',gap:8}}>
              <button className="zm-icon-btn" onClick={saveDraft} title="Save Draft"><Edit3 size={14}/></button>
              <button className="zm-icon-btn" onClick={() => setCompose(null)}><X size={16}/></button>
            </div>
          </div>
          <div className="zm-compose-fields">
            <input className="zm-compose-field" placeholder="To" value={compose.to} onChange={e => setCompose(c => ({...c, to: e.target.value}))}/>
            <input className="zm-compose-field" placeholder="CC" value={compose.cc} onChange={e => setCompose(c => ({...c, cc: e.target.value}))}/>
            <input className="zm-compose-field" placeholder="BCC" value={compose.bcc} onChange={e => setCompose(c => ({...c, bcc: e.target.value}))}/>
            <input className="zm-compose-field" placeholder="Subject" value={compose.subject} onChange={e => setCompose(c => ({...c, subject: e.target.value}))}/>
          </div>
          <textarea className="zm-compose-body"
            value={compose.content.replace(/<[^>]*>/g, '')}
            onChange={e => setCompose(c => ({...c, content: e.target.value.replace(/\n/g, '<br>')}))} placeholder="Write your message here…" />
          <div className="zm-compose-footer">
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <input ref={composeFileRef} type="file" style={{display:'none'}} onChange={e => setComposeAttachment(e.target.files[0])}/>
              <button className="zm-icon-btn" onClick={() => composeFileRef.current.click()}>
                <Paperclip size={15}/>
              </button>
              {composeAttachment && <span className="zm-att-chip-small">{composeAttachment.name} <button onClick={() => setComposeAttachment(null)}>×</button></span>}
            </div>
            <button className="zm-send-btn" onClick={sendEmail}>
              <Send size={15}/> Send
            </button>
          </div>
        </div>
      )}

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div className="zm-preview-overlay" onClick={() => setPreviewAttachment(null)}>
          <div className="zm-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="zm-compose-header">
              <span style={{display: 'flex', alignItems: 'center', gap: 8}}><Paperclip size={14}/> {previewAttachment.attachmentName}</span>
              <div style={{display:'flex',gap:8}}>
                <a className="zm-icon-btn" href={`${API}/api/zoho/mail/attachments/download?message_id=${selectedEmail.messageId}&attachment_id=${previewAttachment.attachmentId}&filename=${encodeURIComponent(previewAttachment.attachmentName)}&folder_id=${detail?.folderId || ''}&account_id=${selectedAccountId || ''}`} target="_blank" rel="noreferrer" title="Open in New Tab" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit'}}><Download size={14}/></a>
                <button className="zm-icon-btn" onClick={() => setPreviewAttachment(null)}><X size={16}/></button>
              </div>
            </div>
            <div style={{flex: 1, overflow: 'hidden', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0 0 16px 16px'}}>
              <iframe 
                src={`${API}/api/zoho/mail/attachments/download?message_id=${selectedEmail.messageId}&attachment_id=${previewAttachment.attachmentId}&filename=${encodeURIComponent(previewAttachment.attachmentName)}&folder_id=${detail?.folderId || ''}&account_id=${selectedAccountId || ''}`}
                style={{width: '100%', height: '100%', border: 'none', borderRadius: '0 0 16px 16px'}}
                title="Attachment Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`zm-toast zm-toast--${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
          {toast.message}
        </div>
      )}
    </div>
  );
}


