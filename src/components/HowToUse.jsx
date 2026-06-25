import { useState } from 'react';
import {
  Mail, Zap, Smartphone, BarChart2, ChevronRight, ChevronDown,
  CheckCircle2, AlertCircle, Lightbulb, Terminal, Upload,
  Eye, Send, Users, FileText, QrCode,
  Settings, RefreshCw, Star, ArrowRight, Play, BookOpen,
  Shield, Cpu, Globe
} from 'lucide-react';
import './HowToUse.css';

const modules = [
  {
    id: 'zohomail',
    label: 'Zoho Mail',
    icon: Mail,
    color: '#4f8ef7',
    gradient: 'linear-gradient(135deg,#4f8ef7,#1d4ed8)',
    tagline: 'Full email client inside your dashboard',
    steps: [
      {
        title: 'Connect your Zoho account',
        icon: Shield,
        content: 'Go to Settings → Zoho Mail tab → click "Connect Zoho Account". You will be redirected to Zoho to authorize the app.',
        tip: 'You can connect multiple Zoho accounts and switch between them.',
        warning: null,
        code: null,
      },
      {
        title: 'Browse Folders & Labels',
        icon: FileText,
        content: 'After connecting, the left sidebar automatically loads all your folders (Inbox, Sent, Drafts, Trash, Spam) and custom labels. Click any folder to load its emails.',
        tip: 'Your folder list updates live. Custom folders you create in Zoho appear here automatically.',
        warning: null,
        code: null,
      },
      {
        title: 'Read & manage emails',
        icon: Eye,
        content: 'Click any email row to open it. The full content renders inside a reading panel. You can:\n• ↩ Reply\n• → Forward\n• 🗑 Delete\n• ⭐ Star / Flag',
        tip: 'Emails are marked as read automatically when you open them.',
        warning: null,
        code: null,
      },
      {
        title: 'Compose & send emails',
        icon: Send,
        content: 'Click the ✏️ compose button (top-right of mail panel). Fill in:\n• To address\n• Subject\n• Message body\n• Optionally attach a file\n\nHit Send — delivered via Zoho Mail API.',
        tip: null,
        warning: 'Make sure your Zoho API scopes include ZohoMail.messages.ALL — otherwise sending may fail.',
        code: null,
      },
      {
        title: 'Search mail',
        icon: Globe,
        content: 'Use the search bar at the top of the mail panel. Press Enter to search across your entire mailbox. Results replace the current list.',
        tip: 'Click any folder to clear search results and return to folder view.',
        warning: null,
        code: null,
      },
    ],
  },
  {
    id: 'automail',
    label: 'AutoMail',
    icon: Zap,
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg,#f59e0b,#d97706)',
    tagline: 'Bulk personalized email campaigns',
    steps: [
      {
        title: 'Prepare your CSV file',
        icon: FileText,
        content: 'Create a CSV with at minimum one column named Email. Add extra columns for personalization — Name, Company, Role, etc.',
        tip: 'Use the template at automail_template.csv in the project root as your starting point.',
        warning: null,
        code: 'Name,Email,Company,Role\nJohn Doe,john@acme.com,Acme Corp,CEO\nJane Smith,jane@tech.com,TechCo,CTO',
      },
      {
        title: 'Select send-from account',
        icon: Settings,
        content: 'At the top of the Compose panel, use the "Send From" dropdown to choose which connected Zoho account to send from.',
        tip: 'Connect additional accounts in Settings → Zoho Mail to unlock more sending options.',
        warning: null,
        code: null,
      },
      {
        title: 'Upload CSV & preview',
        icon: Upload,
        content: 'Drag-and-drop or click the upload zone to select your CSV. The app shows:\n• A preview table of the first 3 rows\n• Quick-insert variable chips (e.g. {Name}, {Company})',
        tip: 'Click any chip to instantly insert that variable at the cursor position in your message.',
        warning: null,
        code: null,
      },
      {
        title: 'Write your email',
        icon: Mail,
        content: 'Fill in the Subject and Message Body. Use {ColumnName} placeholders for personalization. Every recipient gets a unique version of the email.\n\nExample subject: "Hello {Name} from {Company}!"',
        tip: null,
        warning: null,
        code: 'Subject: Important update for {Company}\n\nHi {Name},\n\nAs the {Role} at {Company}, we wanted\nto share some news with you...',
      },
      {
        title: 'Launch & track',
        icon: BarChart2,
        content: 'Click "Launch Campaign". The backend immediately returns — emails are dispatched in the background at a safe rate (120/min). Watch live progress bars update in the right panel.',
        tip: 'Switch to the Campaigns tab for a detailed breakdown with success rates and ETA.',
        warning: null,
        code: null,
      },
    ],
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    icon: Smartphone,
    color: '#25d366',
    gradient: 'linear-gradient(135deg,#25d366,#128c7e)',
    tagline: 'Free bulk WhatsApp via your own account',
    steps: [
      {
        title: 'Start the WhatsApp service',
        icon: Terminal,
        content: 'Open a new terminal and run the WhatsApp microservice. It starts a headless browser that connects to WhatsApp Web.',
        tip: 'Keep this terminal open while using the WhatsApp module.',
        warning: 'You must run this before using the WhatsApp module. The main Python backend alone cannot send WhatsApp messages.',
        code: 'cd whatsapp-service\nnode index.js',
      },
      {
        title: 'Scan the QR code',
        icon: QrCode,
        content: 'Back in the app, open the WhatsApp tab. A QR code banner appears at the top.\n\nOn your phone:\n1. Open WhatsApp\n2. Tap ⋮ → Linked Devices\n3. Tap "Link a Device"\n4. Scan the QR code',
        tip: 'Once scanned, the status badge changes to "Connected" and the QR code disappears.',
        warning: 'If scanning fails with "Couldn\'t link device", the service will generate a fresh QR automatically — just wait and scan again.',
        code: null,
      },
      {
        title: 'Prepare your contacts CSV',
        icon: Users,
        content: 'Create a CSV file with a Phone column. Include country code (no + sign). Add any extra columns for personalization.',
        tip: 'Use large_whatsapp_test.csv in the project folder as a ready-made 150-contact test file.',
        warning: null,
        code: 'Name,Phone,Company,Status\nJohn,919876543210,Acme,Active\nJane,919876543211,TechCo,Pending',
      },
      {
        title: 'Test before bulk send',
        icon: Play,
        content: 'Switch to the Test Message tab. Enter any phone number and a message, then click "Send Test Message". Confirm delivery before launching your full campaign.',
        tip: 'The test message supports the same attachment as the bulk campaign.',
        warning: null,
        code: null,
      },
      {
        title: 'Launch bulk campaign',
        icon: Send,
        content: 'In the Compose tab:\n1. Upload your CSV\n2. Click column chips to insert variables\n3. Optionally attach an image or document\n4. Set a delay (2s recommended)\n5. Click "Send to X contacts"',
        tip: 'The ETA counter shows estimated total time. Switch to Campaigns tab to see live progress.',
        warning: 'Sending too fast may trigger WhatsApp rate limits. Use at least 2s delay for large lists.',
        code: null,
      },
    ],
  },
  {
    id: 'campaigns',
    label: 'Campaigns',
    icon: BarChart2,
    color: '#818cf8',
    gradient: 'linear-gradient(135deg,#818cf8,#6366f1)',
    tagline: 'Live tracking for all your bulk campaigns',
    steps: [
      {
        title: 'Open the Campaigns tab',
        icon: BarChart2,
        content: 'Click "Campaigns" in the left sidebar. The tracker loads automatically and shows all campaigns you have ever run — Email and WhatsApp combined.',
        tip: 'The page polls every 3 seconds. You never need to refresh manually.',
        warning: null,
        code: null,
      },
      {
        title: 'Read the stats cards',
        icon: Star,
        content: 'The top row shows:\n• Total campaigns\n• Total messages sent\n• Total failed\n• Currently running\n• Overall success rate\n• Email vs WhatsApp breakdown',
        tip: 'Success rate turns red below 70%, orange below 90%, and green above 90%.',
        warning: null,
        code: null,
      },
      {
        title: 'Filter campaigns',
        icon: Settings,
        content: 'Use the filter bar to narrow down:\n• All — show everything\n• Running — only in-progress campaigns\n• Completed — finished campaigns\n• Email Only / WhatsApp Only',
        tip: null,
        warning: null,
        code: null,
      },
      {
        title: 'Expand a campaign row',
        icon: Eye,
        content: 'Click the chevron (v) button on any campaign row to expand it. You will see:\n• Start and finish timestamps\n• Duration\n• Per-campaign success rate\n• List of failed recipients (email or phone)',
        tip: 'Failed recipients are shown so you can retry them manually or create a new campaign targeting only those contacts.',
        warning: null,
        code: null,
      },
      {
        title: 'Delete old campaigns',
        icon: RefreshCw,
        content: 'Click the 🗑 trash button on any completed or cancelled campaign to remove it from the view. Email campaign history persists in campaigns_log.json even after server restart.',
        tip: null,
        warning: 'WhatsApp campaign history is stored in-memory only and will clear when the WA service restarts.',
        code: null,
      },
    ],
  },
];

export default function HowToUse() {
  const [activeModule, setActiveModule] = useState('zohomail');
  const [expandedStep, setExpandedStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState({});

  const mod = modules.find(m => m.id === activeModule);

  const toggleStep = (i) => {
    setExpandedStep(prev => prev === i ? null : i);
  };

  const markDone = (e, modId, stepIdx) => {
    e.stopPropagation();
    setCompletedSteps(prev => {
      const key = `${modId}-${stepIdx}`;
      const updated = { ...prev };
      if (updated[key]) delete updated[key];
      else updated[key] = true;
      return updated;
    });
  };

  const isDone = (modId, idx) => !!completedSteps[`${modId}-${idx}`];
  const doneCount = mod.steps.filter((_, i) => isDone(mod.id, i)).length;

  return (
    <div className="htu-root">
      {/* Header */}
      <div className="htu-header">
        <div className="htu-header-left">
          <div className="htu-header-icon"><BookOpen size={22} /></div>
          <div>
            <h1 className="htu-title">How To Use</h1>
            <p className="htu-subtitle">Step-by-step interactive guide for every module</p>
          </div>
        </div>
        <div className="htu-badge-row">
          <span className="htu-badge"><Cpu size={12}/> CEO Command Center</span>
          <span className="htu-badge htu-badge--green"><CheckCircle2 size={12}/> {Object.keys(completedSteps).length} steps completed</span>
        </div>
      </div>

      {/* Module Selector */}
      <div className="htu-module-grid">
        {modules.map(m => {
          const Icon = m.icon;
          const done = m.steps.filter((_, i) => isDone(m.id, i)).length;
          const isActive = activeModule === m.id;
          return (
            <button
              key={m.id}
              className={`htu-module-card ${isActive ? 'active' : ''}`}
              style={isActive ? { '--mod-color': m.color, borderColor: m.color + '44', background: m.color + '12' } : { '--mod-color': m.color }}
              onClick={() => { setActiveModule(m.id); setExpandedStep(0); }}
            >
              <div className="htu-mod-icon" style={{ background: m.gradient }}>
                <Icon size={20} color="#fff" />
              </div>
              <div className="htu-mod-info">
                <div className="htu-mod-name" style={{ color: isActive ? m.color : undefined }}>{m.label}</div>
                <div className="htu-mod-tagline">{m.tagline}</div>
              </div>
              <div className="htu-mod-progress-wrap">
                <div className="htu-mod-progress-ring">
                  <svg width="38" height="38" viewBox="0 0 38 38">
                    <circle cx="19" cy="19" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3"/>
                    <circle cx="19" cy="19" r="15" fill="none"
                      stroke={m.color} strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${(done / m.steps.length) * 94} 94`}
                      strokeDashoffset="23.5"
                      style={{ transition: 'stroke-dasharray 0.5s ease' }}
                    />
                  </svg>
                  <span className="htu-ring-text" style={{ color: m.color }}>{done}/{m.steps.length}</span>
                </div>
              </div>
              {isActive && <div className="htu-mod-active-bar" style={{ background: m.gradient }} />}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="htu-content">
        {/* Left: Progress overview */}
        <div className="htu-sidebar">
          <div className="htu-sidebar-header" style={{ borderColor: mod.color + '33' }}>
            <div className="htu-sidebar-icon" style={{ background: mod.gradient }}><mod.icon size={16} color="#fff"/></div>
            <div>
              <div className="htu-sidebar-title" style={{ color: mod.color }}>{mod.label}</div>
              <div className="htu-sidebar-sub">{doneCount} of {mod.steps.length} completed</div>
            </div>
          </div>

          <div className="htu-progress-bar-wrap">
            <div className="htu-progress-bar-track">
              <div className="htu-progress-bar-fill" style={{ width: `${(doneCount / mod.steps.length) * 100}%`, background: mod.gradient }} />
            </div>
            <span className="htu-progress-pct">{Math.round(doneCount / mod.steps.length * 100)}%</span>
          </div>

          <div className="htu-step-nav">
            {mod.steps.map((step, i) => {
              const done = isDone(mod.id, i);
              const active = expandedStep === i;
              return (
                <button
                  key={i}
                  className={`htu-step-nav-item ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                  style={active ? { '--scolor': mod.color, borderColor: mod.color + '40', background: mod.color + '10' } : {}}
                  onClick={() => toggleStep(i)}
                >
                  <div className="htu-step-nav-num" style={{ background: done ? mod.color : active ? mod.color + '22' : undefined, borderColor: active || done ? mod.color : undefined, color: done ? '#fff' : active ? mod.color : undefined }}>
                    {done ? <CheckCircle2 size={11} /> : i + 1}
                  </div>
                  <div className="htu-step-nav-label">{step.title}</div>
                  {active && <ChevronRight size={13} style={{ color: mod.color, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Step detail */}
        <div className="htu-steps">
          {mod.steps.map((step, i) => {
            const StepIcon = step.icon;
            const done = isDone(mod.id, i);
            const open = expandedStep === i;
            return (
              <div key={i} className={`htu-step ${open ? 'open' : ''} ${done ? 'done' : ''}`} style={open ? { borderColor: mod.color + '33' } : {}}>
                {/* Step header — always visible */}
                <div className="htu-step-head" onClick={() => toggleStep(i)}>
                  <div className="htu-step-num" style={{ background: done ? mod.color : open ? mod.color + '20' : 'rgba(255,255,255,0.05)', borderColor: open || done ? mod.color : 'transparent', color: done ? '#fff' : open ? mod.color : '#64748b' }}>
                    {done ? <CheckCircle2 size={14} /> : <StepIcon size={14} />}
                  </div>
                  <div className="htu-step-title-wrap">
                    <span className="htu-step-num-label" style={{ color: mod.color }}>Step {i + 1}</span>
                    <span className="htu-step-title">{step.title}</span>
                  </div>
                  <div className="htu-step-right">
                    {done && <span className="htu-done-pill" style={{ background: mod.color + '20', color: mod.color }}><CheckCircle2 size={10}/> Done</span>}
                    {open ? <ChevronDown size={16} style={{ color: '#475569' }} /> : <ChevronRight size={16} style={{ color: '#334155' }} />}
                  </div>
                </div>

                {/* Expanded content */}
                {open && (
                  <div className="htu-step-body">
                    <div className="htu-step-content">
                      <p className="htu-step-text">{step.content}</p>
                    </div>

                    {step.code && (
                      <div className="htu-code-block">
                        <div className="htu-code-header"><Terminal size={12}/> Example</div>
                        <pre className="htu-code">{step.code}</pre>
                      </div>
                    )}

                    {step.tip && (
                      <div className="htu-callout htu-callout--tip">
                        <Lightbulb size={14} />
                        <div><strong>Pro Tip</strong><br />{step.tip}</div>
                      </div>
                    )}

                    {step.warning && (
                      <div className="htu-callout htu-callout--warning">
                        <AlertCircle size={14} />
                        <div><strong>Important</strong><br />{step.warning}</div>
                      </div>
                    )}

                    <div className="htu-step-footer">
                      <button
                        className="htu-mark-btn"
                        style={{ background: done ? 'rgba(239,68,68,0.08)' : mod.color + '15', border: `1px solid ${done ? 'rgba(239,68,68,0.2)' : mod.color + '40'}`, color: done ? '#f87171' : mod.color }}
                        onClick={(e) => markDone(e, mod.id, i)}
                      >
                        {done ? <><AlertCircle size={13}/> Mark as Pending</> : <><CheckCircle2 size={13}/> Mark as Done</>}
                      </button>
                      {i < mod.steps.length - 1 && (
                        <button className="htu-next-btn" style={{ background: mod.gradient }} onClick={() => setExpandedStep(i + 1)}>
                          Next Step <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
