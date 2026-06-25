import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import ZohoMail from './components/ZohoMail';
import WhatsAppSender from './components/WhatsAppSender';
import Automail from './components/Automail';
import SettingsPage from './components/Settings';
import CampaignTracker from './components/CampaignTracker';
import HowToUse from './components/HowToUse';
import Teams from './components/Teams';
import Login from './components/Login';
import PayoutDetail from './components/PayoutDetail';
import ReportDashboard from './components/ReportDashboard';
import VerificationSummary from './components/VerificationSummary';
import VerificationFlow from './components/VerificationFlow';
import './App.css';

const AUTH_KEY = 'ceo_cc_auth';

function checkSession() {
  try {
    const ls = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
    if (!ls) return null;
    const parsed = JSON.parse(ls);
    if (Date.now() - parsed.at > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(AUTH_KEY);
      return null;
    }
    // Support both old format (string) and new format (object)
    if (typeof parsed === 'string') return { user: parsed, role: 'admin', at: Date.now() };
    return parsed;
  } catch { return null; }
}

function App() {
  const [session, setSession]         = useState(() => checkSession());
  const [activeModule, setActiveModule] = useState('dashboard');

  const role = session?.role || 'admin';
  const user = session?.user || '';

  // PayoutWing users are locked to the payout module
  useEffect(() => {
    if (role === 'payout') setActiveModule('payout');
  }, [role]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('zoho_auth') === 'success') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
    setSession(null);
    setActiveModule('dashboard');
  };

  if (!session) return <Login onLogin={(payload) => setSession(payload)} />;

  const handleNavigate = (mod) => {
    // PayoutWing users cannot navigate away from payout
    if (role === 'payout') return;
    setActiveModule(mod);
  };

  const renderModule = () => {
    // PayoutWing always sees only the payout page
    if (role === 'payout') return <PayoutDetail />;

    switch (activeModule) {
      case 'dashboard':          return <Dashboard onNavigate={handleNavigate} />;
      case 'mail':               return <ZohoMail />;
      case 'whatsapp':           return <WhatsAppSender />;
      case 'automail':           return <Automail />;
      case 'campaigns':          return <CampaignTracker />;
      case 'teams':              return <Teams />;
      case 'guide':              return <HowToUse />;
      case 'settings':           return <SettingsPage onLogout={handleLogout} />;
      case 'payout':             return <PayoutDetail />;
      case 'reports':            return <ReportDashboard />;
      case 'verification':       return <VerificationSummary />;
      case 'verification-flow':  return <VerificationFlow />;
      default:                   return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        activeModule={activeModule}
        setActiveModule={handleNavigate}
        user={user}
        role={role}
        onLogout={handleLogout}
      />
      <main className="main-content">
        {renderModule()}
      </main>
    </div>
  );
}

export default App;
