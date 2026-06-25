import { useState } from 'react';
import { Phone, BookOpen, Scale, Wallet, Plus, Mail, MessageCircle, User, X, ChevronRight, FileText, Map } from 'lucide-react';
import PayoutDetail from './PayoutDetail';
import ReportDashboard from './ReportDashboard';
import VerificationFlow from './VerificationFlow';
import VerificationSummary from './VerificationSummary';
import './Teams.css';

const TEAM_CONFIG = [
  {
    id: 'telecalling',
    label: 'Telecalling',
    icon: Phone,
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
    border: 'rgba(99,102,241,0.25)',
    description: 'Outbound calling team managing lead follow-ups and client outreach.',
    members: [],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: BookOpen,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.25)',
    description: 'Finance & accounts team handling invoicing, payments, and reconciliation.',
    members: [],
  },
  {
    id: 'legal',
    label: 'Legal',
    icon: Scale,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.25)',
    description: 'Legal team managing contracts, compliance, and regulatory matters.',
    members: [],
  },
  {
    id: 'payout',
    label: 'Payout',
    icon: Wallet,
    color: '#e11d48',
    bg: 'rgba(225,29,72,0.10)',
    border: 'rgba(225,29,72,0.22)',
    description: 'Payout team handling salary processing, vendor payments, and disbursements.',
    members: [],
  },
];

const STORAGE_KEY = 'ceo_teams_members';

function loadMembers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

function saveMembers(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function AddMemberModal({ teamLabel, color, onAdd, onClose }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({ id: Date.now(), name: name.trim(), role: role.trim(), email: email.trim(), phone: phone.trim() });
  };

  return (
    <div className="tm-modal-overlay" onClick={onClose}>
      <div className="tm-modal" style={{ '--mc': color }} onClick={e => e.stopPropagation()}>
        <div className="tm-modal-header">
          <h3 className="tm-modal-title">Add Member — {teamLabel}</h3>
          <button className="tm-modal-close" onClick={onClose}><X size={16} /></button>
        </div>
        <form className="tm-modal-form" onSubmit={handleSubmit}>
          <label className="tm-field">
            <span>Name *</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" autoFocus />
          </label>
          <label className="tm-field">
            <span>Role / Designation</span>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Senior Analyst" />
          </label>
          <label className="tm-field">
            <span>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" />
          </label>
          <label className="tm-field">
            <span>Phone</span>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" />
          </label>
          <div className="tm-modal-actions">
            <button type="button" className="tm-btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="tm-btn-add" style={{ background: color }}>Add Member</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MemberCard({ member, color, onRemove }) {
  const initials = member.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="tm-member-card">
      <div className="tm-member-avatar" style={{ background: color }}>{initials}</div>
      <div className="tm-member-info">
        <div className="tm-member-name">{member.name}</div>
        {member.role && <div className="tm-member-role">{member.role}</div>}
        <div className="tm-member-contacts">
          {member.email && (
            <a href={`mailto:${member.email}`} className="tm-contact-link" title={member.email}>
              <Mail size={11} /> {member.email}
            </a>
          )}
          {member.phone && (
            <a href={`tel:${member.phone}`} className="tm-contact-link" title={member.phone}>
              <MessageCircle size={11} /> {member.phone}
            </a>
          )}
        </div>
      </div>
      <button className="tm-member-remove" onClick={() => onRemove(member.id)} title="Remove member">
        <X size={13} />
      </button>
    </div>
  );
}

export default function Teams() {
  const [allMembers, setAllMembers] = useState(loadMembers);
  const [activeTeam, setActiveTeam] = useState(null);
  const [activeAccountTab, setActiveAccountTab] = useState(null);
  const [addingTo, setAddingTo] = useState(null);

  const getMembersFor = (teamId) => allMembers[teamId] || [];

  const handleAddMember = (teamId, member) => {
    const updated = { ...allMembers, [teamId]: [...getMembersFor(teamId), member] };
    setAllMembers(updated);
    saveMembers(updated);
    setAddingTo(null);
  };

  const handleRemoveMember = (teamId, memberId) => {
    const updated = { ...allMembers, [teamId]: getMembersFor(teamId).filter(m => m.id !== memberId) };
    setAllMembers(updated);
    saveMembers(updated);
  };

  const activeConfig = TEAM_CONFIG.find(t => t.id === activeTeam);
  const activeMembers = activeTeam ? getMembersFor(activeTeam) : [];

  return (
    <div className="tm-root">
      {/* Header */}
      <div className="tm-header">
        <div className="tm-header-glow" />
        <div className="tm-header-content">
          {activeTeam && (
            <button className="tm-back-btn" onClick={() => {
              if (activeAccountTab) setActiveAccountTab(null);
              else setActiveTeam(null);
            }}>
              ← {activeAccountTab ? 'Back to Accounts' : 'Back to Teams'}
            </button>
          )}
          <h1 className="tm-title">{activeTeam ? activeConfig.label : 'Teams'}</h1>
          <p className="tm-subtitle">
            {activeTeam ? activeConfig.description : 'Manage your internal teams and their members.'}
          </p>
        </div>
      </div>

      {activeTeam === 'telecalling' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#F0F4F8' }}>
          <ReportDashboard />
        </div>
      )}

      {activeTeam === 'payout' && (
        <div style={{ flex: 1 }}>
          <PayoutDetail />
        </div>
      )}

      {activeTeam === 'accounts' && activeAccountTab === 'flow' && (
        <div style={{ flex: 1 }}>
          <VerificationFlow />
        </div>
      )}

      {activeTeam === 'accounts' && activeAccountTab === 'summary' && (
        <div style={{ flex: 1 }}>
          <VerificationSummary />
        </div>
      )}

      {activeTeam === 'accounts' && !activeAccountTab && (
        <div className="tm-body">
          <div className="tm-cards-grid">
            {/* Summary Card */}
            <div className="tm-team-card" style={{ '--tc': '#3b82f6', '--tb': 'rgba(59,130,246,0.12)', '--tbo': 'rgba(59,130,246,0.25)' }} onClick={() => setActiveAccountTab('summary')}>
              <div className="tm-team-card-icon" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}>
                <FileText size={28} color="#3b82f6" />
              </div>
              <div className="tm-team-card-body">
                <div className="tm-team-card-label">Verification Summary</div>
                <div className="tm-team-card-desc">Simple report and statistics of investments.</div>
                <div className="tm-team-card-footer">
                  <span className="tm-team-arrow" style={{ color: '#3b82f6' }}><ChevronRight size={16} /></span>
                </div>
              </div>
            </div>

            {/* Flow Card */}
            <div className="tm-team-card" style={{ '--tc': '#10b981', '--tb': 'rgba(16,185,129,0.12)', '--tbo': 'rgba(16,185,129,0.25)' }} onClick={() => setActiveAccountTab('flow')}>
              <div className="tm-team-card-icon" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <Map size={28} color="#10b981" />
              </div>
              <div className="tm-team-card-body">
                <div className="tm-team-card-label">Verification Flow</div>
                <div className="tm-team-card-desc">Detailed interactive pipeline map and health metrics.</div>
                <div className="tm-team-card-footer">
                  <span className="tm-team-arrow" style={{ color: '#10b981' }}><ChevronRight size={16} /></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="tm-body" style={{ display: (activeTeam === 'payout' || activeTeam === 'telecalling' || activeTeam === 'accounts') ? 'none' : undefined }}>
        {!activeTeam ? (
          /* Team Cards Grid */
          <div className="tm-cards-grid">
            {TEAM_CONFIG.map(({ id, label, icon: Icon, color, bg, border, description }) => {
              const count = getMembersFor(id).length;
              return (
                <div
                  key={id}
                  className="tm-team-card"
                  style={{ '--tc': color, '--tb': bg, '--tbo': border }}
                  onClick={() => setActiveTeam(id)}
                >
                  <div className="tm-team-card-icon" style={{ background: bg, border: `1px solid ${border}` }}>
                    <Icon size={28} color={color} />
                  </div>
                  <div className="tm-team-card-body">
                    <div className="tm-team-card-label">{label}</div>
                    <div className="tm-team-card-desc">{description}</div>
                    <div className="tm-team-card-footer">
                      <span className="tm-member-count" style={{ color }}>
                        <User size={12} /> {count} {count === 1 ? 'member' : 'members'}
                      </span>
                      <span className="tm-team-arrow" style={{ color }}><ChevronRight size={16} /></span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Team Detail View */
          <div className="tm-detail">
            <div className="tm-detail-toolbar">
              <span className="tm-detail-count" style={{ color: activeConfig.color }}>
                <User size={14} /> {activeMembers.length} {activeMembers.length === 1 ? 'member' : 'members'}
              </span>
              <button
                className="tm-add-btn"
                style={{ background: activeConfig.color }}
                onClick={() => setAddingTo(activeTeam)}
              >
                <Plus size={15} /> Add Member
              </button>
            </div>

            {activeMembers.length === 0 ? (
              <div className="tm-empty">
                <div className="tm-empty-icon" style={{ background: activeConfig.bg }}>
                  <activeConfig.icon size={32} color={activeConfig.color} />
                </div>
                <div className="tm-empty-text">No members yet</div>
                <div className="tm-empty-sub">Click "Add Member" to add your first team member.</div>
              </div>
            ) : (
              <div className="tm-members-grid">
                {activeMembers.map(member => (
                  <MemberCard
                    key={member.id}
                    member={member}
                    color={activeConfig.color}
                    onRemove={(id) => handleRemoveMember(activeTeam, id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {addingTo && (
        <AddMemberModal
          teamLabel={TEAM_CONFIG.find(t => t.id === addingTo)?.label}
          color={TEAM_CONFIG.find(t => t.id === addingTo)?.color}
          onAdd={(m) => handleAddMember(addingTo, m)}
          onClose={() => setAddingTo(null)}
        />
      )}
    </div>
  );
}
