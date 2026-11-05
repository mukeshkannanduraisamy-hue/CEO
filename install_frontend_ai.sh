#!/bin/bash
set -e

F=/home/u403881955/domains/betappl.kcnanja.com/public_html

echo "=== 1. WRITE AI-ASSISTANT.JS ==="
cat << 'EOF' > "$F/ai-assistant.js"
/**
 * Stumpix Cricket League - AI Assistant & Admin AI Settings Integration
 * Exclusively for Betappl (Beta environment: https://betappl.kcnanja.com).
 * Strict isolation: Does not touch or send data to Live production.
 */
(function () {
  'use strict';

  const API_BASE = 'https://betapplapi.kcnanja.com/api';

  function getAuth() {
    try {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('accessToken');
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(decodeURIComponent(escape(window.atob(base64))));
      return {
        token,
        payload,
        role: payload.role || '',
        email: payload.email || '',
        userId: payload.userId || '',
      };
    } catch (e) {
      return null;
    }
  }

  function isAdmin() {
    const auth = getAuth();
    if (!auth) return false;
    return auth.role === 'super_admin' || auth.role === 'admin';
  }

  let currentAiConfig = null;
  let isChatOpen = false;
  let isSending = false;
  const sessionId = 'admin-session-' + Date.now();

  function injectStyles() {
    if (document.getElementById('stumpix-ai-styles')) return;
    const style = document.createElement('style');
    style.id = 'stumpix-ai-styles';
    style.textContent = `
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
      .ai-admin-panel {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
        margin: 20px 0;
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
        box-sizing: border-box;
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

  function renderFloatingBot() {
    if (!isAdmin()) {
      const existingBtn = document.getElementById('stumpix-ai-btn');
      if (existingBtn) existingBtn.remove();
      const existingDrawer = document.getElementById('stumpix-ai-drawer');
      if (existingDrawer) existingDrawer.remove();
      return;
    }

    if (document.getElementById('stumpix-ai-btn')) return;

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
            <p id="ai-model-label">Gemini 1.5 Flash · Live Connected</p>
          </div>
        </div>
        <div class="ai-header-actions">
          <button type="button" class="ai-icon-btn" id="ai-clear-btn" title="Clear Chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
          </button>
          <button type="button" class="ai-icon-btn" id="ai-close-btn" title="Close Drawer">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
      <div class="ai-messages-list" id="ai-messages">
        <div class="ai-msg assistant">
          <div class="ai-msg-bubble">
            <p><strong>👋 Welcome Admin!</strong></p>
            <p>I am your Stumpix AI Assistant. I can help analyze tournament data, check player registrations, monitor auction budgets, and answer league questions.</p>
            <div class="ai-quick-prompts">
              <button class="ai-prompt-chip" data-prompt="Give me a comprehensive overview of the tournament status.">🏆 Tournament Summary</button>
              <button class="ai-prompt-chip" data-prompt="How many players and teams are registered right now?">👥 Registration Stats</button>
              <button class="ai-prompt-chip" data-prompt="List all team franchises and their squad breakdown.">🏏 Team Roster</button>
              <button class="ai-prompt-chip" data-prompt="Summarize the current auction status and remaining purse.">💰 Auction Purse</button>
            </div>
          </div>
        </div>
      </div>
      <form class="ai-drawer-composer" id="ai-composer">
        <textarea class="ai-input-box" id="ai-input" rows="1" placeholder="Ask AI about matches, teams, players..."></textarea>
        <button type="submit" class="ai-send-btn" id="ai-send" title="Send message">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </form>
    `;
    document.body.appendChild(drawer);

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

    drawer.addEventListener('click', (e) => {
      const chip = e.target.closest('.ai-prompt-chip');
      if (chip && chip.dataset.prompt) {
        sendMessage(chip.dataset.prompt);
      }
    });

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
  }

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
      const res = await fetch(`${API_BASE}/settings/ai/chat`, {
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

      removeTypingIndicator();
      const data = await res.json();

      if (!res.ok) {
        const errMsg = (data && data.error && data.error.message) || data.message || 'Request failed';
        appendMessage('assistant', `❌ **AI Notice**: ${errMsg}`);
      } else {
        const reply = data.data && data.data.reply ? data.data.reply : data.reply;
        appendMessage('assistant', reply);
      }
    } catch (err) {
      removeTypingIndicator();
      appendMessage('assistant', `⚠️ **Network Error**: Unable to reach AI service: ${err.message}`);
    } finally {
      isSending = false;
    }
  }

  function appendMessage(role, text) {
    const list = document.getElementById('ai-messages');
    if (!list) return;

    const div = document.createElement('div');
    div.className = `ai-msg ${role}`;

    let formatted = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');

    div.innerHTML = `<div class="ai-msg-bubble"><p>${formatted}</p></div>`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }

  function showTypingIndicator() {
    const list = document.getElementById('ai-messages');
    if (!list) return;
    const existing = document.getElementById('ai-typing');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'ai-typing';
    div.className = 'ai-msg assistant';
    div.innerHTML = `
      <div class="ai-typing">
        <span class="ai-typing-dot"></span>
        <span class="ai-typing-dot"></span>
        <span class="ai-typing-dot"></span>
      </div>
    `;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }

  function removeTypingIndicator() {
    const el = document.getElementById('ai-typing');
    if (el) el.remove();
  }

  function checkAndInjectSettingsTab() {
    if (!isAdmin()) return;
    if (!window.location.pathname.includes('/settings')) return;

    const nav = document.querySelector('nav') || document.querySelector('.nav-tabs') || document.querySelector('[role="tablist"]');
    if (!nav) return;

    if (document.getElementById('ai-connect-tab-btn')) return;

    const tabBtn = document.createElement('button');
    tabBtn.id = 'ai-connect-tab-btn';
    tabBtn.type = 'button';
    tabBtn.className = 'tab-btn';
    tabBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px; vertical-align:middle;">
        <rect x="3" y="11" width="18" height="10" rx="2"></rect>
        <circle cx="12" cy="5" r="2"></circle>
        <path d="M12 7v4"></path>
      </svg>
      <span>AI Connect</span>
    `;
    nav.appendChild(tabBtn);

    tabBtn.addEventListener('click', () => {
      nav.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');

      document.querySelectorAll('form, section, .tab-pane, .settings-content').forEach((p) => {
        if (!p.closest('#ai-admin-settings-container')) {
          p.setAttribute('data-ai-hidden', 'true');
          p.style.display = 'none';
        }
      });

      renderAiSettingsPanel();
    });

    nav.addEventListener('click', (e) => {
      if (!e.target.closest('#ai-connect-tab-btn')) {
        tabBtn.classList.remove('active');
        const aiPanel = document.getElementById('ai-admin-settings-container');
        if (aiPanel) aiPanel.remove();
        document.querySelectorAll('[data-ai-hidden="true"]').forEach((p) => {
          p.removeAttribute('data-ai-hidden');
          p.style.display = '';
        });
      }
    });
  }

  async function renderAiSettingsPanel() {
    let container = document.getElementById('ai-admin-settings-container');
    if (container) container.remove();

    container = document.createElement('div');
    container.id = 'ai-admin-settings-container';
    container.className = 'ai-admin-panel';

    const parent = document.querySelector('main') || document.querySelector('app-root') || document.body;
    parent.appendChild(container);

    container.innerHTML = `
      <header>
        <div>
          <h2>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2">
              <rect x="3" y="11" width="18" height="10" rx="2"></rect>
              <circle cx="12" cy="5" r="2"></circle>
              <path d="M12 7v4"></path>
            </svg>
            AI API Connect
          </h2>
          <p class="desc">Configure Google Gemini AI credentials, model engine, and role permissions.</p>
        </div>
        <div id="ai-status-pill" style="font-size:12px; font-weight:800; padding:6px 14px; border-radius:9999px; background:#f1f5f9; color:#64748b;">
          Loading...
        </div>
      </header>

      <div class="ai-toggle-row">
        <div>
          <strong style="display:block; font-size:14px; color:#0f172a;">Enable AI Assistant</strong>
          <span style="font-size:12px; color:#64748b;">Activate floating chatbot and assistant queries on Beta</span>
        </div>
        <label style="position:relative; display:inline-block; width:48px; height:26px;">
          <input type="checkbox" id="ai-toggle-switch" style="opacity:0; width:0; height:0;">
          <span id="ai-toggle-slider" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:#cbd5e1; border-radius:34px; transition:0.3s;"></span>
        </label>
      </div>

      <div class="ai-form-group">
        <label>AI Provider</label>
        <select class="ai-input" id="ai-provider-select">
          <option value="gemini">Google Gemini (Recommended - Multimodal & Fast)</option>
          <option value="openai">OpenAI (Custom Gateway)</option>
          <option value="custom">Custom Endpoint / Self-Hosted</option>
        </select>
      </div>

      <div class="ai-form-group">
        <label>Gemini API Key</label>
        <div style="position:relative; display:flex; align-items:center;">
          <input type="password" class="ai-input" id="ai-api-key" placeholder="Enter your Gemini API key (AIza...)" style="padding-right:45px;">
          <button type="button" id="ai-eye-btn" style="position:absolute; right:10px; background:none; border:none; color:#64748b; cursor:pointer;">👁</button>
        </div>
        <p class="hint">Your key is encrypted on the server and masked in the UI. Leave blank to keep existing saved key.</p>
      </div>

      <div class="ai-form-group">
        <label>Model Engine</label>
        <select class="ai-input" id="ai-model-select">
          <option value="gemini-1.5-flash">Gemini 1.5 Flash (Ultra-fast, Recommended)</option>
          <option value="gemini-2.0-flash">Gemini 2.0 Flash (Next-Gen High Performance)</option>
          <option value="gemini-1.5-pro">Gemini 1.5 Pro (Deep Reasoning & Strategy)</option>
        </select>
      </div>

      <div class="ai-form-group">
        <label>Role Permissions (Access Control)</label>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:normal; cursor:pointer;">
            <input type="checkbox" checked disabled> <strong>Super Admin</strong> (Active & Gated)
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:normal; color:#94a3b8;">
            <input type="checkbox" disabled> Franchise Owners (Coming soon)
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:normal; color:#94a3b8;">
            <input type="checkbox" disabled> Registered Players (Coming soon)
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:normal; color:#94a3b8;">
            <input type="checkbox" disabled> Public Visitors (Coming soon)
          </label>
        </div>
        <p class="hint">The floating bot is currently gated strictly to Admins only. Future updates will allow toggling access for team owners and players.</p>
      </div>

      <div class="ai-form-group">
        <label>System Instructions (League Personality)</label>
        <textarea class="ai-input" id="ai-system-prompt" rows="3" placeholder="Define how the AI should respond..."></textarea>
      </div>

      <div id="ai-test-result" style="display:none; padding:12px; border-radius:10px; margin-bottom:16px; font-size:13px;"></div>

      <div style="display:flex; gap:12px; margin-top:20px;">
        <button type="button" class="ai-btn-secondary" id="ai-test-btn">
          ⚡ Test Connection
        </button>
        <button type="button" class="ai-btn-primary" id="ai-save-btn">
          💾 Save Changes
        </button>
      </div>
    `;

    const auth = getAuth();
    if (!auth) return;

    try {
      const res = await fetch(`${API_BASE}/settings/ai`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const data = await res.json();
      if (res.ok && data.data && data.data.ai) {
        currentAiConfig = data.data.ai;
        populateSettingsForm(currentAiConfig);
      }
    } catch (e) {
      console.error('Failed to load AI settings:', e);
    }

    const toggle = document.getElementById('ai-toggle-switch');
    const slider = document.getElementById('ai-toggle-slider');
    toggle.addEventListener('change', () => {
      slider.style.background = toggle.checked ? '#0ea5e9' : '#cbd5e1';
      updateStatusPill(toggle.checked);
    });

    const eyeBtn = document.getElementById('ai-eye-btn');
    const keyInput = document.getElementById('ai-api-key');
    eyeBtn.addEventListener('click', () => {
      keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    });

    document.getElementById('ai-test-btn').addEventListener('click', async () => {
      const resultBox = document.getElementById('ai-test-result');
      resultBox.style.display = 'block';
      resultBox.style.background = '#f8fafc';
      resultBox.style.color = '#334155';
      resultBox.style.border = '1px solid #cbd5e1';
      resultBox.textContent = 'Testing connection with Google Gemini...';

      const keyVal = keyInput.value.trim();
      const modelVal = document.getElementById('ai-model-select').value;

      try {
        const res = await fetch(`${API_BASE}/settings/ai/test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({
            apiKey: keyVal,
            model: modelVal,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          resultBox.style.background = '#dcfce7';
          resultBox.style.color = '#15803d';
          resultBox.style.border = '1px solid #86efac';
          resultBox.textContent = `✅ ${data.message || 'Connected successfully to Gemini!'}`;
        } else {
          resultBox.style.background = '#fee2e2';
          resultBox.style.color = '#b91c1c';
          resultBox.style.border = '1px solid #fca5a5';
          resultBox.textContent = `❌ ${data.message || (data.error && data.error.message) || 'Test failed'}`;
        }
      } catch (err) {
        resultBox.style.background = '#fee2e2';
        resultBox.style.color = '#b91c1c';
        resultBox.style.border = '1px solid #fca5a5';
        resultBox.textContent = `❌ Network Error: ${err.message}`;
      }
    });

    document.getElementById('ai-save-btn').addEventListener('click', async () => {
      const saveBtn = document.getElementById('ai-save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const payload = {
        enabled: toggle.checked,
        provider: document.getElementById('ai-provider-select').value,
        apiKey: keyInput.value.trim(),
        model: document.getElementById('ai-model-select').value,
        systemPrompt: document.getElementById('ai-system-prompt').value.trim(),
        allowedRoles: 'super_admin',
      };

      try {
        const res = await fetch(`${API_BASE}/settings/ai`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          alert('✅ AI Settings saved successfully! Changes are active immediately.');
          if (data.data && data.data.ai) {
            populateSettingsForm(data.data.ai);
          }
        } else {
          alert(`❌ Failed to save: ${data.message || 'Unknown error'}`);
        }
      } catch (e) {
        alert(`❌ Network error while saving: ${e.message}`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Changes';
      }
    });
  }

  function populateSettingsForm(cfg) {
    const toggle = document.getElementById('ai-toggle-switch');
    const slider = document.getElementById('ai-toggle-slider');
    if (toggle) {
      toggle.checked = !!cfg.enabled;
      slider.style.background = cfg.enabled ? '#0ea5e9' : '#cbd5e1';
      updateStatusPill(cfg.enabled);
    }
    const prov = document.getElementById('ai-provider-select');
    if (prov && cfg.provider) prov.value = cfg.provider;

    const key = document.getElementById('ai-api-key');
    if (key && cfg.apiKey) key.placeholder = `Saved: ${cfg.apiKey} (Type to replace)`;

    const mod = document.getElementById('ai-model-select');
    if (mod && cfg.model) mod.value = cfg.model;

    const sys = document.getElementById('ai-system-prompt');
    if (sys && cfg.systemPrompt) sys.value = cfg.systemPrompt;
  }

  function updateStatusPill(enabled) {
    const pill = document.getElementById('ai-status-pill');
    if (!pill) return;
    if (enabled) {
      pill.style.background = '#dcfce7';
      pill.style.color = '#15803d';
      pill.textContent = '● AI ACTIVE';
    } else {
      pill.style.background = '#f1f5f9';
      pill.style.color = '#64748b';
      pill.textContent = '○ AI DISABLED';
    }
  }

  function init() {
    injectStyles();
    renderFloatingBot();
    checkAndInjectSettingsTab();

    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        checkAndInjectSettingsTab();
        renderFloatingBot();
      }
    }).observe(document, { subtree: true, childList: true });

    window.addEventListener('storage', () => {
      renderFloatingBot();
      checkAndInjectSettingsTab();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
EOF

echo "=== 2. INJECT SCRIPT TAG INTO INDEX.HTML ==="
INDEX_HTML="$F/index.html"
if ! grep -q "ai-assistant.js" "$INDEX_HTML"; then
  sed -i 's/<\/body>/<script src="ai-assistant.js" defer><\/script><\/body>/' "$INDEX_HTML"
  echo "ai-assistant.js injected into index.html."
else
  echo "ai-assistant.js already present in index.html."
fi

chmod 644 "$F/ai-assistant.js"
echo "=== FRONTEND DEPLOYMENT COMPLETE ==="
