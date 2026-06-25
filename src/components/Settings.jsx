import { useState, useEffect, useCallback } from 'react';
import { Mail, Plus, Trash2, Star, CheckCircle2, AlertCircle, Settings } from 'lucide-react';
import './Settings.css';

const API = import.meta.env.DEV ? 'http://localhost:8000' : '';

export default function SettingsPage({ onLogout }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(null); // account id to remove
  const [confirmLogout, setConfirmLogout] = useState(false);

  const notify = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAccounts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/zoho/connected-accounts`).then(r => r.json());
      setAccounts(r.accounts || []);
    } catch { notify('Failed to load accounts', 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const connectNewAccount = () => {
    setShowConnectModal(false);
    const params = new URLSearchParams({ mode: 'add' });
    if (clientId.trim()) params.append('client_id', clientId.trim());
    if (clientSecret.trim()) params.append('client_secret', clientSecret.trim());

    const popup = window.open(`${API}/api/auth/zoho?${params.toString()}`, '_blank', 'width=600,height=700');
    
    // Poll for popup close
    const poll = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(poll);
        fetchAccounts();
        notify('Account connection completed!');
      }
    }, 1000);
    setTimeout(() => clearInterval(poll), 300000); // 5 min timeout
  };

  const removeAccount = async (id) => {
    setConfirmRemove(id);
  };

  const doRemoveAccount = async (id) => {
    setConfirmRemove(null);
    try {
      await fetch(`${API}/api/zoho/connected-accounts/${id}`, { method: 'DELETE' });
      setAccounts(prev => prev.filter(a => a.id !== id));
      notify('Account disconnected');
    } catch { notify('Failed to remove account', 'error'); }
  };

  const setDefault = async (id) => {
    try {
      await fetch(`${API}/api/zoho/connected-accounts/${id}/default`, { method: 'PUT' });
      setAccounts(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
      notify('Default account updated');
    } catch { notify('Failed to update default', 'error'); }
  };

  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];
  const getColor = (i) => colors[i % colors.length];

  return (
    <div className="settings-root">
      <h1 className="settings-title">Settings</h1>
      <p className="settings-subtitle">Manage your connected email accounts and preferences.</p>

      <div className="settings-section">
        <div className="settings-section-title">
          <Mail size={18} color="#6366f1" /> Connected Mail Accounts
        </div>
        <p className="settings-section-desc">
          Connect up to 5 Zoho Mail accounts. Switch between them directly in the mail view.
        </p>

        {loading ? (
          <div style={{ padding: '24px', color: '#475569', textAlign: 'center' }}>Loading accounts…</div>
        ) : accounts.length === 0 ? (
          <div className="empty-accounts">
            <Mail size={48} />
            <h3>No accounts connected</h3>
            <p>Connect your first Zoho Mail account to get started.</p>
          </div>
        ) : (
          <table className="accounts-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Status</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc, i) => (
                <tr key={acc.id}>
                  <td>
                    <div className="acc-cell">
                      <div className="acc-avatar" style={{ background: `linear-gradient(135deg, ${getColor(i)}, ${getColor(i+1)})` }}>
                        {(acc.displayName || acc.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="acc-name">{acc.displayName || acc.email}</div>
                        <div className="acc-email">{acc.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="badge-connected">Connected</span></td>
                  <td>
                    {acc.isDefault
                      ? <span className="badge-default"><Star size={10} fill="currentColor" /> Default</span>
                      : <button className="btn-sm btn-ghost" onClick={() => setDefault(acc.id)}>Set Default</button>
                    }
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button className="btn-sm btn-danger-ghost" onClick={() => removeAccount(acc.id)}>
                        <Trash2 size={13} /> Disconnect
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="connect-footer">
          <p>{accounts.length}/5 accounts connected</p>
          <button className="btn-primary" onClick={() => setShowConnectModal(true)} disabled={accounts.length >= 5}>
            <Plus size={16} /> Connect Account
          </button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">
          <Settings size={18} color="#6366f1" /> How to connect multiple accounts
        </div>
        <p className="settings-section-desc">
          Click <strong style={{color:'#818cf8'}}>Connect Account</strong> above. A Zoho login window will open — sign in with the account you want to add. The account will appear in the table and be selectable in the mail view.
        </p>
        <div style={{display:'flex', gap:12, flexWrap:'wrap'}}>
          {[
            { label: 'Personal Email', hint: 'Your primary inbox' },
            { label: 'Work Email', hint: 'Business communications' },
            { label: 'Support Email', hint: 'Customer-facing alias' },
          ].map((item, i) => (
            <div key={i} style={{flex:1, minWidth:180, padding:'16px', background:'rgba(99,102,241,0.04)', border:'1px solid rgba(99,102,241,0.1)', borderRadius:12}}>
              <div style={{fontSize:13, fontWeight:700, color:'#818cf8', marginBottom:4}}>{item.label}</div>
              <div style={{fontSize:12, color:'#475569'}}>{item.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="settings-section">
        <div className="settings-section-title">
          <Settings size={18} color="#ef4444" /> Session & Security
        </div>
        <p className="settings-section-desc">
          Sign out of the CEO Command Center. Your Zoho account connections will remain saved.
        </p>
        {confirmLogout && (
          <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: 380, textAlign: 'center'}}>
              <h3 style={{marginBottom: 10, color: '#1e293b'}}>Sign Out?</h3>
              <p style={{fontSize: 14, color: '#64748b', marginBottom: 24}}>You will be returned to the login screen. Your Zoho account connections remain saved.</p>
              <div style={{display: 'flex', justifyContent: 'center', gap: 12}}>
                <button className="btn-ghost" style={{padding: '9px 20px', cursor: 'pointer', borderRadius: 8, fontFamily: 'inherit'}} onClick={() => setConfirmLogout(false)}>Cancel</button>
                <button className="btn-danger-ghost" style={{padding: '9px 20px', fontSize: 13.5, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 8, cursor: 'pointer'}} onClick={() => { setConfirmLogout(false); onLogout && onLogout(); }}>Yes, Sign Out</button>
              </div>
            </div>
          </div>
        )}

        {confirmRemove && (
          <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: 380, textAlign: 'center'}}>
              <h3 style={{marginBottom: 10, color: '#1e293b'}}>Disconnect Account?</h3>
              <p style={{fontSize: 14, color: '#64748b', marginBottom: 24}}>This will remove the Zoho account from this dashboard. You can reconnect it at any time.</p>
              <div style={{display: 'flex', justifyContent: 'center', gap: 12}}>
                <button className="btn-ghost" style={{padding: '9px 20px', cursor: 'pointer', borderRadius: 8, fontFamily: 'inherit'}} onClick={() => setConfirmRemove(null)}>Cancel</button>
                <button className="btn-danger-ghost" style={{padding: '9px 20px', fontSize: 13.5, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 8, cursor: 'pointer'}} onClick={() => doRemoveAccount(confirmRemove)}>Disconnect</button>
              </div>
            </div>
          </div>
        )}

        <button
          className="btn-danger-ghost"
          style={{ padding: '10px 20px', fontSize: 13.5, fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 8, cursor: 'pointer' }}
          onClick={() => setConfirmLogout(true)}
        >
          Sign Out
        </button>
      </div>

      {toast && (
        <div className={`settings-toast ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
          {toast.message}
        </div>
      )}

      {showConnectModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: 450}}>
            <h3 style={{marginBottom: 8, color: '#1e293b'}}>Connect Zoho Account</h3>
            <p style={{fontSize: 14, color: '#64748b', marginBottom: 20}}>
              You can optionally provide your own Zoho OAuth Client ID and Secret. If left blank, the default application credentials will be used.
            </p>
            
            <div style={{marginBottom: 16}}>
              <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#475569'}}>Client ID (Optional)</label>
              <input 
                type="text" 
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="1000.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                style={{width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14}}
              />
            </div>
            
            <div style={{marginBottom: 24}}>
              <label style={{display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#475569'}}>Client Secret (Optional)</label>
              <input 
                type="password" 
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
                placeholder="Enter client secret"
                style={{width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14}}
              />
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: 12}}>
              <button className="btn-ghost" onClick={() => setShowConnectModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={connectNewAccount}>Connect via Zoho</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
