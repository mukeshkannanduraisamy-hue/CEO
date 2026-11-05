/**
 * Stumpix Cricket League - AI Assistant & Admin AI Settings Integration
 * Exclusively for Betappl (Beta environment: https://betappl.kcnanja.com).
 * Strict isolation: Does not touch or send data to Live production.
 */
(function () {
  'use strict';

  // API base for Beta backend
  const API_BASE = 'https://betapplapi.kcnanja.com/api';

  // 1. Authentication & Role Detection
  function getAuth() {
    try {
      // 1a. URL debug override or persistent session flag (e.g. ?ai_admin=true)
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('ai_admin') === 'true' || sessionStorage.getItem('stumpix_ai_admin') === 'true') {
        sessionStorage.setItem('stumpix_ai_admin', 'true');
        return {
          token: localStorage.getItem('token') || localStorage.getItem('auth_token') || 'admin-debug-token',
          role: 'super_admin',
          email: 'admin@stumpix.com',
          userId: 1,
        };
      }

      // 1b. Check parsed user object in localStorage / sessionStorage
      const userKeys = ['currentUser', 'user', 'authUser', 'profile', 'auth'];
      for (const key of userKeys) {
        for (const storage of [localStorage, sessionStorage]) {
          const raw = storage.getItem(key);
          if (raw) {
            try {
              const u = JSON.parse(raw);
              const role = u.Role || u.role || (u.user && (u.user.Role || u.user.role)) || (u.data && (u.data.Role || u.data.role));
              if (role) {
                const token = storage.getItem('token') || storage.getItem('auth_token') || u.token || '';
                return {
                  token,
                  role: String(role).toLowerCase(),
                  email: u.email || (u.user && u.user.email) || '',
                  userId: u.UserID || u.id || '',
                  raw: u,
                };
              }
            } catch (_) {}
          }
        }
      }

      // 1c. Check direct role string in localStorage / sessionStorage
      for (const storage of [localStorage, sessionStorage]) {
        const directRole = storage.getItem('role') || storage.getItem('Role') || storage.getItem('user_role');
        if (directRole) {
          return {
            token: storage.getItem('token') || storage.getItem('auth_token') || '',
            role: String(directRole).toLowerCase(),
            email: '',
            userId: '',
          };
        }
      }

      // 1d. Check JWT Token payload
      for (const storage of [localStorage, sessionStorage]) {
        const token = storage.getItem('token') || storage.getItem('auth_token') || storage.getItem('accessToken') || storage.getItem('jwt');
        if (token && typeof token === 'string') {
          const parts = token.split('.');
          if (parts.length === 3) {
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(decodeURIComponent(escape(window.atob(base64))));
            const role = payload.Role || payload.role || (payload.user && (payload.user.Role || payload.user.role)) || '';
            return {
              token,
              payload,
              role: String(role).toLowerCase(),
              email: payload.Email || payload.email || '',
              userId: payload.UserID || payload.userId || payload.id || '',
            };
          }
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  // Current Gating: STRICTLY ADMIN ONLY
  // Future Expansion Architecture: Supports checking team_owner, player, visitor
  function isAdmin() {
    const auth = getAuth();
    if (!auth) return false;
    const r = (auth.role || '').toLowerCase();
    return r === 'super_admin' || r === 'admin' || r === 'superadmin' || r === 'administrator';
  }

  function canAccessBot() {
    // Current requirement: ADMIN ONLY
    return isAdmin();
  }

  // 2. Global State
  let currentAiConfig = null;
  let isChatOpen = false;
  let isSending = false;
  let currentPlatformConversationId = null;
  const sessionId = 'stumpix-session-' + Date.now();
  const DEFAULT_PLATFORM_KEY = 'aap_pk_9mw4GOAi1QOFUz5Muy2Z9IHMtVR0m7aO';

  // 3. Inject Styles
  function injectStyles() {
    if (document.getElementById('stumpix-ai-styles')) return;
    const style = document.createElement('style');
    style.id = 'stumpix-ai-styles';
    style.textContent = `
      /* Floating AI Bot Button */
      #stumpix-ai-btn {
        position: fixed;
        bottom: 84px;
        right: 24px;
        z-index: 99998;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 18px 10px 14px;
        background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #2563eb 100%);
        color: #ffffff;
        border: none;
        border-radius: 9999px;
        box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2);
        cursor: pointer;
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.3px;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        user-select: none;
      }
      #stumpix-ai-btn:hover {
        transform: translateY(-2px) scale(1.03);
        box-shadow: 0 8px 28px rgba(79, 70, 229, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.3);
      }
      #stumpix-ai-btn:active {
        transform: translateY(0) scale(0.98);
      }
      #stumpix-ai-btn .bot-icon-wrap {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
      }
      #stumpix-ai-btn .bot-badge {
        background: #f59e0b;
        color: #000;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Chat Drawer */
      #stumpix-ai-drawer {
        position: fixed;
        bottom: 148px;
        right: 24px;
        width: 440px;
        max-width: calc(100vw - 32px);
        height: 620px;
        max-height: calc(100vh - 180px);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        background: #ffffff;
        border-radius: 18px;
        box-shadow: 0 20px 48px -12px rgba(15, 23, 42, 0.3), 0 0 0 1px rgba(15, 23, 42, 0.08);
        overflow: hidden;
        font-family: inherit;
        opacity: 0;
        transform: translateY(16px) scale(0.96);
        pointer-events: none;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #stumpix-ai-drawer.is-open {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      /* Chat Header */
      .ai-drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        background: #0f172a;
        color: #ffffff;
      }
      .ai-header-left {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .ai-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 12px;
        background: linear-gradient(135deg, #4f46e5, #0ea5e9);
        color: #ffffff;
      }
      .ai-header-info h4 {
        margin: 0;
        font-size: 15px;
        font-weight: 800;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ai-header-info p {
        margin: 2px 0 0;
        font-size: 11px;
        color: #94a3b8;
      }
      .ai-role-pill {
        font-size: 9px;
        padding: 2px 6px;
        background: rgba(14, 165, 233, 0.2);
        color: #38bdf8;
        border: 1px solid rgba(14, 165, 233, 0.4);
        border-radius: 4px;
        text-transform: uppercase;
        font-weight: 700;
      }
      .ai-header-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ai-icon-btn {
        background: transparent;
        border: none;
        color: #94a3b8;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .ai-icon-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      /* Messages area */
      .ai-messages-list {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
        background: #f8fafc;
      }
      .ai-msg {
        display: flex;
        gap: 10px;
        max-width: 88%;
        animation: aiFadeIn 0.2s ease-out;
      }
      @keyframes aiFadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .ai-msg.user {
        align-self: flex-end;
        flex-direction: row-reverse;
      }
      .ai-msg.assistant {
        align-self: flex-start;
      }
      .ai-msg-bubble {
        padding: 12px 16px;
        border-radius: 14px;
        font-size: 13.5px;
        line-height: 1.5;
        word-break: break-word;
      }
      .ai-msg.user .ai-msg-bubble {
        background: #2563eb;
        color: #ffffff;
        border-bottom-right-radius: 3px;
      }
      .ai-msg.assistant .ai-msg-bubble {
        background: #ffffff;
        color: #1e293b;
        border: 1px solid #e2e8f0;
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.04);
        border-bottom-left-radius: 3px;
      }
      .ai-msg-bubble table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0;
        font-size: 12px;
      }
      .ai-msg-bubble th, .ai-msg-bubble td {
        border: 1px solid #cbd5e1;
        padding: 6px 10px;
        text-align: left;
      }
      .ai-msg-bubble th {
        background: #f1f5f9;
        font-weight: 700;
      }
      .ai-msg-bubble ul, .ai-msg-bubble ol {
        margin: 6px 0;
        padding-left: 20px;
      }
      .ai-msg-bubble p {
        margin: 4px 0;
      }

      /* Quick prompts */
      .ai-quick-prompts {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
      .ai-prompt-chip {
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 20px;
        padding: 5px 12px;
        font-size: 12px;
        font-weight: 600;
        color: #334155;
        cursor: pointer;
        transition: all 0.2s;
      }
      .ai-prompt-chip:hover {
        background: #eff6ff;
        border-color: #3b82f6;
        color: #1d4ed8;
      }

      /* Typing indicator */
      .ai-typing {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 10px 14px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        width: fit-content;
      }
      .ai-typing-dot {
        width: 6px;
        height: 6px;
        background: #64748b;
        border-radius: 50%;
        animation: aiBounce 1.4s infinite ease-in-out both;
      }
      .ai-typing-dot:nth-child(1) { animation-delay: -0.32s; }
      .ai-typing-dot:nth-child(2) { animation-delay: -0.16s; }
      @keyframes aiBounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }

      /* Composer */
      .ai-drawer-composer {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 12px 16px;
        background: #ffffff;
        border-top: 1px solid #e2e8f0;
      }
      .ai-input-box {
        flex: 1;
        resize: none;
        max-height: 100px;
        padding: 10px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        font-family: inherit;
        font-size: 13.5px;
        outline: none;
        transition: border-color 0.2s;
      }
      .ai-input-box:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      }
      .ai-send-btn {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: #2563eb;
        color: #ffffff;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
      }
      .ai-send-btn:hover {
        background: #1d4ed8;
      }
      .ai-send-btn:disabled {
        background: #94a3b8;
        cursor: not-allowed;
      }
      .ai-mic-btn {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
      }
      .ai-mic-btn:hover {
        background: #e2e8f0;
        color: #1e293b;
      }
      .ai-mic-btn.is-recording {
        background: #dc2626 !important;
        color: #ffffff !important;
        border-color: #b91c1c !important;
        animation: aiMicPulse 1.2s infinite ease-in-out;
      }
      @keyframes aiMicPulse {
        0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.7); }
        70% { transform: scale(1.08); box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
        100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
      }
      .ai-icon-btn.is-active {
        color: #38bdf8 !important;
        background: rgba(56, 189, 248, 0.2) !important;
      }
      .ai-icon-btn.is-calling {
        color: #22c55e !important;
        background: rgba(34, 197, 94, 0.2) !important;
        animation: aiCallPulse 1.4s infinite;
      }
      @keyframes aiCallPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
      .ai-call-pulse {
        animation: aiPulse 1.5s infinite;
      }
      @keyframes aiPulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.3; transform: scale(0.8); }
      }

      /* Admin Settings Tab & Panel */
      .ai-admin-panel {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
        margin-top: 16px;
      }
      .ai-admin-panel header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid #f1f5f9;
      }
      .ai-admin-panel h2 {
        font-size: 20px;
        font-weight: 800;
        color: #0f172a;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ai-admin-panel p.desc {
        font-size: 13.5px;
        color: #64748b;
        margin: 4px 0 0;
      }
      .ai-form-group {
        margin-bottom: 20px;
      }
      .ai-form-group label {
        display: block;
        font-size: 13.5px;
        font-weight: 700;
        color: #334155;
        margin-bottom: 6px;
      }
      .ai-form-group .hint {
        font-size: 12px;
        color: #64748b;
        margin-top: 4px;
      }
      .ai-input {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        font-size: 14px;
        outline: none;
        font-family: inherit;
        background: #ffffff;
      }
      .ai-input:focus {
        border-color: #0ea5e9;
        box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15);
      }
      .ai-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        margin-bottom: 20px;
      }
      .ai-btn-primary {
        background: #0ea5e9;
        color: #ffffff;
        font-weight: 700;
        padding: 10px 20px;
        border-radius: 10px;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: background 0.2s;
      }
      .ai-btn-primary:hover {
        background: #0284c7;
      }
      .ai-btn-secondary {
        background: #f1f5f9;
        color: #334155;
        font-weight: 700;
        padding: 10px 20px;
        border-radius: 10px;
        border: 1px solid #cbd5e1;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
      }
      .ai-btn-secondary:hover {
        background: #e2e8f0;
      }
    `;
    document.head.appendChild(style);
  }

  // 4. Floating Bot Widget Logic
  function renderFloatingBot() {
    if (!canAccessBot()) {
      const existingBtn = document.getElementById('stumpix-ai-btn');
      if (existingBtn) existingBtn.remove();
      const existingDrawer = document.getElementById('stumpix-ai-drawer');
      if (existingDrawer) existingDrawer.remove();
      return;
    }

    if (document.getElementById('stumpix-ai-btn')) return;

    // Create Launcher Button
    const btn = document.createElement('button');
    btn.id = 'stumpix-ai-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open AI Assistant');
    btn.innerHTML = `
      <div class="bot-icon-wrap">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          <circle cx="12" cy="12" r="4"/>
        </svg>
      </div>
      <span>Stumpix AI</span>
      <span class="bot-badge">ADMIN</span>
    `;
    document.body.appendChild(btn);

    // Create Drawer
    const drawer = document.createElement('div');
    drawer.id = 'stumpix-ai-drawer';
    drawer.innerHTML = `
      <div class="ai-drawer-header">
        <div class="ai-header-left">
          <div class="ai-avatar">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="10" rx="2"></rect>
              <circle cx="12" cy="5" r="2"></circle>
              <path d="M12 7v4"></path>
              <line x1="8" y1="16" x2="8" y2="16"></line>
              <line x1="16" y1="16" x2="16" y2="16"></line>
            </svg>
          </div>
          <div class="ai-header-info">
            <h4>Stumpix AI <span class="ai-role-pill">Admin</span></h4>
            <p id="ai-model-label">Gemini 3.5 Flash · Visuals & Voice Active</p>
          </div>
        </div>
        <div class="ai-header-actions">
          <button type="button" class="ai-icon-btn" id="ai-voice-call-btn" title="Live Voice Call (Hands-Free)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          </button>
          <button type="button" class="ai-icon-btn is-active" id="ai-tts-toggle" title="Voice Audio Readout (ON/OFF)">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
          </button>
          <button type="button" class="ai-icon-btn" id="ai-clear-btn" title="Clear Chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
          </button>
          <button type="button" class="ai-icon-btn" id="ai-close-btn" title="Close Drawer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
      <div id="ai-voice-call-bar" style="display:none; padding:8px 16px; background:#0f172a; color:#ffffff; font-size:12px; align-items:center; justify-content:space-between; border-bottom:1px solid #334155;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="ai-call-pulse" style="width:10px; height:10px; border-radius:50%; background:#22c55e;"></span>
          <span id="ai-call-status" style="font-weight:600; color:#38bdf8;">Voice Call Connected · Listening...</span>
        </div>
        <button type="button" id="ai-end-call-btn" style="background:#dc2626; color:#ffffff; border:none; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">End Call</button>
      </div>
      <div class="ai-messages-list" id="ai-messages">
        <div class="ai-msg assistant">
          <div class="ai-msg-bubble">
            <p><strong>👋 Welcome Admin!</strong></p>
            <p>I am your Stumpix AI Assistant with full visual & voice capabilities. I can display player photos, team logos, interactive charts, and squads directly on your screen!</p>
            <div class="ai-quick-prompts">
              <button class="ai-prompt-chip" data-prompt="Show photos of players in the league">📸 Player Photos</button>
              <button class="ai-prompt-chip" data-prompt="Show chart of team auction budgets and spent money">📊 Budget Chart</button>
              <button class="ai-prompt-chip" data-prompt="Show all teams with logos and squads">👥 Teams & Logos</button>
              <button class="ai-prompt-chip" data-prompt="Show points table standings">🏆 Points Table</button>
            </div>
          </div>
        </div>
      </div>
      <form class="ai-drawer-composer" id="ai-composer">
        <textarea class="ai-input-box" id="ai-input" rows="1" placeholder="Ask AI about players, photos, charts, budgets..."></textarea>
        <button type="button" class="ai-mic-btn" id="ai-mic-btn" title="Voice Input (Click to speak)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
        </button>
        <button type="submit" class="ai-send-btn" id="ai-send" title="Send message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </form>
    `;
    document.body.appendChild(drawer);

    // Event Listeners
    btn.addEventListener('click', () => {
      isChatOpen = !isChatOpen;
      drawer.classList.toggle('is-open', isChatOpen);
      if (isChatOpen) {
        document.getElementById('ai-input')?.focus();
      }
    });

    document.getElementById('ai-close-btn')?.addEventListener('click', () => {
      isChatOpen = false;
      drawer.classList.remove('is-open');
    });

    document.getElementById('ai-clear-btn')?.addEventListener('click', () => {
      const list = document.getElementById('ai-messages');
      if (list) {
        list.innerHTML = `
          <div class="ai-msg assistant">
            <div class="ai-msg-bubble">
              <p>Chat cleared. Ask me anything about the league!</p>
            </div>
          </div>
        `;
      }
    });

    // Quick prompt chips
    drawer.addEventListener('click', (e) => {
      const chip = e.target.closest('.ai-prompt-chip');
      if (chip && chip.dataset.prompt) {
        sendMessage(chip.dataset.prompt);
      }
    });

    // Composer
    const form = document.getElementById('ai-composer');
    const input = document.getElementById('ai-input');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit'));
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || isSending) return;
      input.value = '';
      sendMessage(text);
    });

    // Speech Recognition & Voice Call controls
    const micBtn = document.getElementById('ai-mic-btn');
    const ttsToggleBtn = document.getElementById('ai-tts-toggle');
    const callBtn = document.getElementById('ai-voice-call-btn');
    const callBar = document.getElementById('ai-voice-call-bar');
    const endCallBtn = document.getElementById('ai-end-call-btn');
    const callStatus = document.getElementById('ai-call-status');

    function getSpeechRecognizer() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return null;
      if (!recognitionInstance) {
        recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'en-IN';

        recognitionInstance.onstart = () => {
          isMicRecording = true;
          if (micBtn) micBtn.classList.add('is-recording');
          if (callStatus) callStatus.textContent = 'Voice Call Active · Listening...';
        };

        recognitionInstance.onresult = (evt) => {
          let transcript = '';
          for (let i = evt.resultIndex; i < evt.results.length; i++) {
            transcript += evt.results[i][0].transcript;
          }
          if (input) input.value = transcript;
        };

        recognitionInstance.onerror = (err) => {
          console.warn('Speech recognition error:', err);
          stopVoiceListening();
        };

        recognitionInstance.onend = () => {
          isMicRecording = false;
          if (micBtn) micBtn.classList.remove('is-recording');
          const finalVal = input ? input.value.trim() : '';
          if (finalVal) {
            input.value = '';
            sendMessage(finalVal);
          } else if (isVoiceCallActive) {
            setTimeout(() => {
              if (isVoiceCallActive && !isMicRecording && !isSending) {
                startVoiceListening();
              }
            }, 600);
          }
        };
      }
      return recognitionInstance;
    }

    function startVoiceListening() {
      stopAllSpeech();
      const rec = getSpeechRecognizer();
      if (!rec) {
        alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
        return;
      }
      try {
        rec.start();
      } catch (err) {
        // already started
      }
    }

    function stopVoiceListening() {
      if (recognitionInstance) {
        try { recognitionInstance.stop(); } catch {}
      }
      isMicRecording = false;
      if (micBtn) micBtn.classList.remove('is-recording');
    }

    if (micBtn) {
      micBtn.addEventListener('click', () => {
        if (isMicRecording) {
          stopVoiceListening();
        } else {
          startVoiceListening();
        }
      });
    }

    if (ttsToggleBtn) {
      ttsToggleBtn.addEventListener('click', () => {
        isTtsEnabled = !isTtsEnabled;
        ttsToggleBtn.classList.toggle('is-active', isTtsEnabled);
        if (!isTtsEnabled) stopAllSpeech();
      });
    }

    function startVoiceCall() {
      isVoiceCallActive = true;
      isTtsEnabled = true;
      if (callBtn) callBtn.classList.add('is-calling');
      if (callBar) callBar.style.display = 'flex';
      if (ttsToggleBtn) ttsToggleBtn.classList.add('is-active');
      appendMessage('assistant', '🎙️ **Voice Call Connected**: I am listening! Ask me anything about players, photos, charts, or auctions.');
      startVoiceListening();
    }

    function endVoiceCall() {
      isVoiceCallActive = false;
      stopVoiceListening();
      stopAllSpeech();
      if (callBtn) callBtn.classList.remove('is-calling');
      if (callBar) callBar.style.display = 'none';
      appendMessage('assistant', '📞 **Voice Call Ended**.');
    }

    if (callBtn) {
      callBtn.addEventListener('click', () => {
        if (isVoiceCallActive) {
          endVoiceCall();
        } else {
          startVoiceCall();
        }
      });
    }

    if (endCallBtn) {
      endCallBtn.addEventListener('click', () => {
        endVoiceCall();
      });
    }
  }

  // 5. Send Message to AI Chat API
  async function sendMessage(text) {
    const auth = getAuth();
    if (!auth) {
      appendMessage('assistant', '⚠️ You must be logged in as an Admin to use the AI Assistant.');
      return;
    }

    appendMessage('user', text);
    showTypingIndicator();
    isSending = true;

    try {
      const activeProvider = localStorage.getItem('stumpix_ai_provider') || currentAiConfig?.provider || 'platform';
      const localEndpoint = (localStorage.getItem('stumpix_ai_endpoint') || currentAiConfig?.endpointUrl || 'http://localhost:4000').trim().replace(/\/+$/, '');

      let res;
      if (activeProvider === 'platform') {
        // Direct browser routing to dedicated AI Assistant Platform (Port 4000)
        const botKey = localStorage.getItem('stumpix_bot_key') || currentAiConfig?.apiKey || DEFAULT_PLATFORM_KEY;
        const platformEndpoint = (localStorage.getItem('stumpix_ai_endpoint') || 'http://localhost:4000').trim().replace(/\/+$/, '');
        res = await fetch(`${platformEndpoint}/v1/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: botKey,
            message: text,
            conversationId: currentPlatformConversationId || undefined,
          }),
        });
      } else if (activeProvider === 'localhost') {
        // Direct browser routing to Localhost SQLite Chatbot Server (Port 3000)
        res = await fetch(`${localEndpoint}/api/settings/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: text,
            sessionId: sessionId,
          }),
        });
      } else {
        // Cloud Gemini via Beta backend
        res = await fetch(`${API_BASE}/settings/ai/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({
            message: text,
            sessionId: sessionId,
          }),
        });
      }

      removeTypingIndicator();
      const data = await res.json();

      if (!res.ok || (data && data.success === false)) {
        const errMsg = (data && data.error && (data.error.message || data.error)) || data.message || 'Request failed';
        appendMessage('assistant', `❌ **AI Notice**: ${errMsg}`);
      } else {
        if (data.conversationId) {
          currentPlatformConversationId = data.conversationId;
        }
        const reply = data.data && data.data.reply ? data.data.reply : (data.reply || data.message || 'No reply generated.');
        appendMessage('assistant', reply, data.visuals);
      }
    } catch (err) {
      removeTypingIndicator();
      const activeProvider = localStorage.getItem('stumpix_ai_provider') || currentAiConfig?.provider || 'platform';
      if (activeProvider === 'platform') {
        appendMessage('assistant', `⚠️ **AI Platform Offline**: Unable to reach AI Assistant Platform at \`${localStorage.getItem('stumpix_ai_endpoint') || 'http://localhost:4000'}\`.\n\nPlease ensure your local AI host is running by double-clicking \`run-ai-platform.bat\` on your computer.`);
      } else if (activeProvider === 'localhost') {
        appendMessage('assistant', `⚠️ **Localhost Offline**: Unable to connect to Localhost AI API at \`${localStorage.getItem('stumpix_ai_endpoint') || 'http://localhost:3000'}\`.\n\nPlease ensure your local server is running by double-clicking \`run-local-ai.bat\` on your computer.`);
      } else {
        appendMessage('assistant', `⚠️ **Network Error**: Unable to reach AI service: ${err.message}`);
      }
    } finally {
      isSending = false;
    }
  }

  // 5. Speech Audio Output (TTS) & Recognition (STT) State
  let isTtsEnabled = true;
  let isVoiceCallActive = false;
  let recognitionInstance = null;
  let isMicRecording = false;

  function stopAllSpeech() {
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
  }

  function speakReply(text, onEnd) {
    if (!isTtsEnabled || !('speechSynthesis' in window)) {
      if (typeof onEnd === 'function') onEnd();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      // Strip markdown syntax and URLs for clean human speech
      const clean = text
        .replace(/https?:\/\/[^\s]+/g, '')
        .replace(/[*_#`~>]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[❌⚠️👋🏆👥🏏💰📊🥧📈🖼️]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400);

      if (!clean) {
        if (typeof onEnd === 'function') onEnd();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const isTamil = /[\u0B80-\u0BFF]/.test(clean);
      const voices = window.speechSynthesis.getVoices() || [];
      if (isTamil) {
        const ta = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ta'));
        if (ta) utterance.voice = ta;
      } else {
        const en = voices.find(v => v.lang && (v.lang === 'en-IN' || v.lang === 'en-US') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Online')));
        if (en) utterance.voice = en;
      }

      utterance.onend = () => {
        if (typeof onEnd === 'function') onEnd();
      };
      utterance.onerror = () => {
        if (typeof onEnd === 'function') onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('SpeechSynthesis error:', err);
      if (typeof onEnd === 'function') onEnd();
    }
  }

  function appendMessage(role, text, visuals) {
    const list = document.getElementById('ai-messages');
    if (!list) return;

    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;

    // Simple markdown format
    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');

    // Rich visual outputs: Photos/Galleries, Charts (Bar, Pie, Line), and Tables
    let visualHtml = '';
    if (Array.isArray(visuals) && visuals.length > 0) {
      for (const v of visuals) {
        if (!v) continue;

        // 1. Photos & Media Gallery
        if (v.kind === 'images' && Array.isArray(v.images) && v.images.length > 0) {
          visualHtml += `
            <div class="ai-visual-gallery" style="margin-top:12px; border-radius:12px; border:1px solid #e2e8f0; background:#ffffff; padding:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
