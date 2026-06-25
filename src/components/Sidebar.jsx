import {
  MessageCircle, Mail, Zap, Command, Settings,
  BarChart2, BookOpen, LogOut, Home, ChevronRight, Users, Wallet,
  ShieldCheck, Activity, FileBarChart
} from 'lucide-react';

const ALL_MENU_ITEMS = [
  { id: 'dashboard',         label: 'Dashboard',           icon: Home,          section: 'OVERVIEW',      roles: ['admin'] },
  { id: 'mail',              label: 'Zoho Mail',           icon: Mail,          section: 'MODULES',       roles: ['admin'] },
  { id: 'automail',          label: 'AutoMail',            icon: Zap,           section: 'MODULES',       roles: ['admin'] },
  { id: 'whatsapp',          label: 'WhatsApp',            icon: MessageCircle, section: 'MODULES',       roles: ['admin'] },
  { id: 'campaigns',         label: 'Campaigns',           icon: BarChart2,     section: 'MODULES',       roles: ['admin'] },
  { id: 'teams',             label: 'Teams',               icon: Users,         section: 'MODULES',       roles: ['admin'] },
  { id: 'payout',            label: 'Payout',              icon: Wallet,        section: 'PAYOUT',        roles: ['admin', 'payout'] },
  { id: 'guide',             label: 'How To Use',          icon: BookOpen,      section: 'TOOLS',         roles: ['admin'] },
];

const ROLE_LABELS = {
  admin:  'Administrator',
  payout: 'PayoutWing',
};

const Sidebar = ({ activeModule, setActiveModule, user = 'CEO', role = 'admin', onLogout }) => {
  const menuItems = ALL_MENU_ITEMS.filter(item => item.roles.includes(role));

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo-ring">
          <Command size={20} color="#fff" />
        </div>
        <div className="sidebar-brand">
          <span className="sidebar-title">CEO Center</span>
          <span className="sidebar-sub">Command Dashboard</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="nav-menu">
        {menuItems.map(({ id, label, icon: Icon, section }, index) => {
          const showLabel = index === 0 || menuItems[index - 1].section !== section;
          return (
            <div key={id}>
              {showLabel && (
                <div className="sidebar-section-label">{section}</div>
              )}
              <div
                className={`nav-item ${activeModule === id ? 'active' : ''}`}
                data-module={id}
                onClick={() => setActiveModule(id)}
              >
                <div className="nav-item-icon">
                  <Icon size={16} />
                </div>
                <span style={{ flex: 1 }}>{label}</span>
                {activeModule === id && <ChevronRight size={13} style={{ opacity: 0.5 }} />}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div>
        <div className="sidebar-divider" />

        {/* Settings — admin only */}
        {role === 'admin' && (
          <div style={{ padding: '6px 10px 6px' }}>
            <div
              className={`nav-item ${activeModule === 'settings' ? 'active' : ''}`}
              data-module="settings"
              onClick={() => setActiveModule('settings')}
            >
              <div className="nav-item-icon">
                <Settings size={16} />
              </div>
              <span style={{ flex: 1 }}>Settings</span>
            </div>
          </div>
        )}

        <div className="sidebar-footer">
          <div className="user-avatar">{(user || 'C').charAt(0).toUpperCase()}</div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <span className="user-name">{user || 'CEO'}</span>
            <span className="user-role">{ROLE_LABELS[role] || 'User'}</span>
          </div>
          {onLogout && (
            <button className="logout-btn" onClick={onLogout} title="Sign out">
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
