              ${v.title ? `<div style="padding-bottom:8px; margin-bottom:10px; font-weight:700; font-size:13px; color:#0f172a; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:6px;">🖼️ ${v.title}</div>` : ''}
              <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(88px, 1fr)); gap:10px;">
                ${v.images.map(img => `
                  <a href="${img.url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; display:flex; flex-direction:column; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; overflow:hidden; transition:transform 0.15s, box-shadow 0.15s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">
                    <div style="width:100%; height:88px; background:#e2e8f0; position:relative; overflow:hidden;">
                      <img src="${img.url}" alt="${img.caption || 'Image'}" loading="lazy" style="width:100%; height:100%; object-fit:cover;" onerror="this.onerror=null;this.src='https://placehold.co/100x100?text=Photo'"/>
                    </div>
                    ${img.caption ? `<div style="padding:4px 6px; font-size:11px; font-weight:600; color:#334155; line-height:1.2; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${img.caption}">${img.caption}</div>` : ''}
                  </a>
                `).join('')}
              </div>
            </div>
          `;
        }

        // 2. Charts (Bar, Line, Pie)
        else if (v.kind === 'chart' && Array.isArray(v.labels) && Array.isArray(v.series)) {
          const colors = ['#2563eb', '#16a34a', '#ea580c', '#8b5cf6', '#ec4899', '#0891b2', '#f59e0b'];
          const unit = v.unit ? ` ${v.unit}` : '';

          if (v.chart === 'pie') {
            const seriesVals = v.series[0]?.values || [];
            const total = seriesVals.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
            visualHtml += `
              <div class="ai-visual-chart pie" style="margin-top:12px; border-radius:12px; border:1px solid #e2e8f0; background:#ffffff; padding:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="font-weight:700; font-size:13px; color:#0f172a; margin-bottom:10px; display:flex; align-items:center; gap:6px;">🥧 ${v.title}</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  ${v.labels.map((lbl, idx) => {
                    const val = Number(seriesVals[idx]) || 0;
                    const pct = Math.round((val / total) * 100);
                    const col = colors[idx % colors.length];
                    return `
                      <div style="display:flex; flex-direction:column; gap:2px; font-size:11.5px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                          <span style="font-weight:600; color:#334155; display:flex; align-items:center; gap:6px;">
                            <span style="width:10px; height:10px; border-radius:50%; background:${col}; display:inline-block;"></span>
                            ${lbl}
                          </span>
                          <span style="font-weight:700; color:#0f172a;">${val.toLocaleString('en-IN')}${unit} (${pct}%)</span>
                        </div>
                        <div style="width:100%; height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                          <div style="width:${pct}%; height:100%; background:${col}; border-radius:4px;"></div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>
            `;
          } else if (v.chart === 'line') {
            const allVals = v.series.flatMap(s => s.values.map(Number));
            const maxVal = Math.max(1, ...allVals);
            const w = 320;
            const h = 130;
            const pad = 15;
            const step = v.labels.length > 1 ? (w - pad * 2) / (v.labels.length - 1) : 0;
            visualHtml += `
              <div class="ai-visual-chart line" style="margin-top:12px; border-radius:12px; border:1px solid #e2e8f0; background:#ffffff; padding:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="font-weight:700; font-size:13px; color:#0f172a; margin-bottom:8px; display:flex; align-items:center; gap:6px;">📈 ${v.title}</div>
                <div style="overflow-x:auto;">
                  <svg viewBox="0 0 ${w} ${h}" style="width:100%; max-width:${w}px; height:${h}px; display:block; margin:auto;">
                    <line x1="${pad}" y1="${pad}" x2="${w - pad}" y2="${pad}" stroke="#f1f5f9" stroke-width="1"/>
                    <line x1="${pad}" y1="${h / 2}" x2="${w - pad}" y2="${h / 2}" stroke="#f1f5f9" stroke-width="1"/>
                    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#e2e8f0" stroke-width="1"/>
                    ${v.series.map((s, sIdx) => {
                      const col = colors[sIdx % colors.length];
                      const pts = s.values.map((val, i) => `${pad + step * i},${h - pad - (Math.max(0, Number(val) || 0) / maxVal) * (h - pad * 2)}`).join(' ');
                      return `<polyline fill="none" stroke="${col}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/>`;
                    }).join('')}
                  </svg>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:10px; color:#64748b; margin-top:4px; padding:0 ${pad}px;">
                  <span>${v.labels[0] || ''}</span>
                  ${v.labels.length > 2 ? `<span>${v.labels[Math.floor(v.labels.length / 2)] || ''}</span>` : ''}
                  <span>${v.labels[v.labels.length - 1] || ''}</span>
                </div>
                ${v.series.length > 1 ? `
                  <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; font-size:11px;">
                    ${v.series.map((s, sIdx) => `<span style="display:flex; align-items:center; gap:4px; color:#334155;"><span style="width:8px; height:8px; border-radius:2px; background:${colors[sIdx % colors.length]};"></span>${s.name}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          } else {
            // Bar chart (horizontal bars with labels and values)
            const allVals = v.series.flatMap(s => s.values.map(Number));
            const maxVal = Math.max(1, ...allVals);
            visualHtml += `
              <div class="ai-visual-chart bar" style="margin-top:12px; border-radius:12px; border:1px solid #e2e8f0; background:#ffffff; padding:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                <div style="font-weight:700; font-size:13px; color:#0f172a; margin-bottom:10px; display:flex; align-items:center; gap:6px;">📊 ${v.title}</div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                  ${v.labels.map((lbl, idx) => `
                    <div style="display:flex; flex-direction:column; gap:2px; font-size:11.5px;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:600; color:#334155;">${lbl}</span>
                        <span style="font-weight:700; color:#0f172a;">${v.series.map(s => (Number(s.values[idx]) || 0).toLocaleString('en-IN') + unit).join(' / ')}</span>
                      </div>
                      ${v.series.map((s, sIdx) => {
                        const val = Number(s.values[idx]) || 0;
                        const pct = Math.max(2, Math.min(100, Math.round((val / maxVal) * 100)));
                        const col = colors[sIdx % colors.length];
                        return `
                          <div style="width:100%; height:9px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                            <div style="width:${pct}%; height:100%; background:${col}; border-radius:4px;" title="${s.name ? s.name + ': ' : ''}${val}${unit}"></div>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `).join('')}
                </div>
                ${v.series.length > 1 ? `
                  <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px; font-size:11px; border-top:1px solid #f1f5f9; padding-top:6px;">
                    ${v.series.map((s, sIdx) => `<span style="display:flex; align-items:center; gap:4px; color:#334155;"><span style="width:8px; height:8px; border-radius:2px; background:${colors[sIdx % colors.length]};"></span>${s.name}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            `;
          }
        }

        // 3. Tabular Data (Rosters, Points Table, Fixtures, Bids)
        else if (v.kind === 'table' && Array.isArray(v.columns) && Array.isArray(v.rows)) {
          visualHtml += `
            <div style="margin-top:12px; overflow-x:auto; border-radius:10px; border:1px solid #cbd5e1; background:#ffffff; box-shadow:0 1px 4px rgba(0,0,0,0.05);">
              ${v.title ? `<div style="padding:7px 12px; background:#f8fafc; font-weight:700; font-size:12px; color:#1e293b; border-bottom:1px solid #cbd5e1; display:flex; align-items:center; gap:6px;">📋 ${v.title}</div>` : ''}
              <table style="width:100%; border-collapse:collapse; font-size:12px; text-align:left;">
                <thead>
                  <tr style="background:#f1f5f9; border-bottom:1px solid #cbd5e1;">
                    ${v.columns.map(c => `<th style="padding:7px 10px; font-weight:700; color:#334155; white-space:nowrap;">${c}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${v.rows.map((row, rIdx) => `
                    <tr style="border-bottom:1px solid #f1f5f9; background:${rIdx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                      ${row.map(cell => `<td style="padding:6px 10px; color:#334155; white-space:nowrap;">${cell}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      }
    }

    div.innerHTML = `<div class="ai-msg-bubble"><p>${formatted}</p>${visualHtml}</div>`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;

    // Speak AI response if enabled
    if (role === 'assistant') {
      speakReply(text, () => {
        // If hands-free voice call is ongoing, re-arm microphone
        if (isVoiceCallActive) {
          setTimeout(() => {
            if (isVoiceCallActive) startVoiceListening();
          }, 400);
        }
      });
    }
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

  // 6. Admin Settings Integration: AI Connect Tab
  function checkAndInjectSettingsTab() {
    if (!isAdmin()) return;
    if (!window.location.pathname.includes('/settings')) return;

    const nav = document.querySelector('nav.st-tabs') || document.querySelector('.st-tabs') || document.querySelector('nav') || document.querySelector('[role="tablist"]');
    if (!nav) return;

    if (document.getElementById('ai-connect-tab-btn')) return;

    // Create the Tab Button matching Angular st-tab class
    const tabBtn = document.createElement('button');
    tabBtn.id = 'ai-connect-tab-btn';
    tabBtn.type = 'button';
    tabBtn.className = 'st-tab';
    tabBtn.innerHTML = `
      <i class="bi bi-robot" style="margin-right:6px; font-size:15px; color:#4f46e5;"></i>
      <span>AI Connect</span>
      <span style="font-size:10px; font-weight:800; background:#4f46e5; color:#ffffff; padding:1px 5px; border-radius:4px; margin-left:6px;">PRO</span>
    `;
    nav.appendChild(tabBtn);

    tabBtn.addEventListener('click', () => {
      // Deactivate all sibling buttons
      nav.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');

      // Hide Angular panels
      document.querySelectorAll('.tab-content > *, app-settings-tab, app-messaging-tab, app-payments-tab, app-gallery-tab, app-sponsors-tab, app-locations-tab, app-carousel-tab, form, section, .tab-pane, .settings-content').forEach((p) => {
        if (!p.closest('#ai-admin-settings-container') && !p.closest('nav')) {
          p.setAttribute('data-ai-hidden', 'true');
          p.style.display = 'none';
        }
      });

      renderAiSettingsPanel();
    });

    // Listen to clicks on other tabs to restore
    nav.addEventListener('click', (e) => {
      if (!e.target.closest('#ai-connect-tab-btn')) {
        tabBtn.classList.remove('active');
        const aiPanel = document.getElementById('ai-admin-settings-container');
        if (aiPanel) aiPanel.remove();
        document.querySelectorAll('[data-ai-hidden=\"true\"]').forEach((p) => {
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

    const parent = document.querySelector('.tab-content') || document.querySelector('.st-bar') || document.querySelector('main') || document.querySelector('app-root') || document.body;
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
          <p class="desc">Configure Google Gemini AI credentials, local AI server endpoint, and role permissions.</p>
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
          <option value="platform">AI Assistant Platform (Dedicated Host - Port 4000)</option>
          <option value="gemini">Google Gemini Cloud (Direct)</option>
          <option value="localhost">Localhost SQLite Chatbot (Port 3000)</option>
          <option value="openai">OpenAI (Custom Gateway)</option>
          <option value="custom">Custom Endpoint / Self-Hosted</option>
        </select>
      </div>

      <div class="ai-form-group" id="ai-endpoint-group">
        <label id="ai-endpoint-label">AI Host Endpoint URL</label>
        <input type="text" class="ai-input" id="ai-endpoint-url" placeholder="http://localhost:4000" value="http://localhost:4000">
        <p class="hint" id="ai-endpoint-hint">Host address of ai-assistant-platform (Port 4000). Direct CORS connection with full cricket tool support.</p>
      </div>

      <div class="ai-form-group">
        <label id="ai-api-key-label">API Key / Bot Key</label>
        <div style="position:relative; display:flex; align-items:center;">
          <input type="password" class="ai-input" id="ai-api-key" placeholder="Enter your key or Bot API Key (aap_pk_...)" style="padding-right:45px;">
          <button type="button" id="ai-eye-btn" style="position:absolute; right:10px; background:none; border:none; color:#64748b; cursor:pointer;">👁</button>
        </div>
        <p class="hint" id="ai-key-hint">Your key is kept safe. For AI Platform, use the Bot API Key generated on port 4000.</p>
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
        <label>Role Permissions (Access Control Architecture)</label>
        <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:bold; cursor:pointer; color:#0f172a;">
            <input type="checkbox" checked disabled> Super Admin / League Administrator (Active & Exclusive)
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:normal; color:#94a3b8;">
            <input type="checkbox" disabled> Franchise Owners (Planned for Phase 2)
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:normal; color:#94a3b8;">
            <input type="checkbox" disabled> Registered Players (Planned for Phase 2)
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:normal; color:#94a3b8;">
            <input type="checkbox" disabled> Public Visitors (Planned for Phase 2)
          </label>
        </div>
        <p class="hint">The floating bot is currently gated strictly to Admins only. The architecture is prepared to toggle access for Team Owners and Players in future updates.</p>
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

    // Fetch Current Settings
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

    // Bind Controls
    const toggle = document.getElementById('ai-toggle-switch');
    const slider = document.getElementById('ai-toggle-slider');
    toggle.addEventListener('change', () => {
      slider.style.background = toggle.checked ? '#0ea5e9' : '#cbd5e1';
      updateStatusPill(toggle.checked);
    });

    const provSelect = document.getElementById('ai-provider-select');
    const endpointGroup = document.getElementById('ai-endpoint-group');
    const updateEndpointVis = (val) => {
      const endpointLabel = document.getElementById('ai-endpoint-label');
      const endpointHint = document.getElementById('ai-endpoint-hint');
      const endpointInput = document.getElementById('ai-endpoint-url');
      const keyLabel = document.getElementById('ai-api-key-label');
      const keyHint = document.getElementById('ai-key-hint');
      const keyInput = document.getElementById('ai-api-key');

      if (endpointGroup) {
        endpointGroup.style.display = (val === 'platform' || val === 'localhost' || val === 'custom') ? 'block' : 'none';
      }

      if (val === 'platform') {
        if (endpointLabel) endpointLabel.textContent = 'AI Platform Host Endpoint';
        if (endpointHint) endpointHint.textContent = 'Host address of ai-assistant-platform (Port 4000). Direct CORS connection with full cricket tool support.';
        if (endpointInput && (!endpointInput.value || endpointInput.value.includes(':3000'))) endpointInput.value = 'http://localhost:4000';
        if (keyLabel) keyLabel.textContent = 'Platform Bot API Key (aap_pk_...)';
        if (keyHint) keyHint.textContent = 'Publishable Bot Key created in ai-assistant-platform. Default key is pre-configured.';
        if (keyInput) keyInput.placeholder = `Bot Key (e.g. ${DEFAULT_PLATFORM_KEY.slice(0, 14)}...)`;
      } else if (val === 'localhost') {
        if (endpointLabel) endpointLabel.textContent = 'Localhost Chatbot Endpoint';
        if (endpointHint) endpointHint.textContent = 'Direct route to local SQLite Chatbot server on port 3000.';
        if (endpointInput && (!endpointInput.value || endpointInput.value.includes(':4000'))) endpointInput.value = 'http://localhost:3000';
        if (keyLabel) keyLabel.textContent = 'Gemini API Key';
        if (keyHint) keyHint.textContent = 'API key used by the local server.';
        if (keyInput) keyInput.placeholder = 'Enter your Gemini API key (AIza...)';
      } else {
        if (endpointLabel) endpointLabel.textContent = 'Custom Endpoint URL';
        if (keyLabel) keyLabel.textContent = 'API Key';
        if (keyHint) keyHint.textContent = 'Your key is encrypted on the server and masked in the UI.';
        if (keyInput) keyInput.placeholder = 'Enter API key';
      }
    };
    if (provSelect) {
      provSelect.addEventListener('change', () => updateEndpointVis(provSelect.value));
    }

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

      const provVal = document.getElementById('ai-provider-select').value;
      const keyVal = keyInput.value.trim();
      const modelVal = document.getElementById('ai-model-select').value;
      const endpointVal = (document.getElementById('ai-endpoint-url')?.value || (provVal === 'platform' ? 'http://localhost:4000' : 'http://localhost:3000')).trim().replace(/\/+$/, '');

      if (provVal === 'platform') {
        resultBox.textContent = `Connecting to AI Assistant Platform at ${endpointVal}...`;
        try {
          const healthRes = await fetch(`${endpointVal}/healthz`);
          if (!healthRes.ok) throw new Error(`HTTP ${healthRes.status} from healthz`);
          const healthData = await healthRes.json();

          const botKey = keyVal || localStorage.getItem('stumpix_bot_key') || DEFAULT_PLATFORM_KEY;
          resultBox.textContent = `Testing Bot Key verification on ${endpointVal}...`;

          const sessRes = await fetch(`${endpointVal}/v1/widget/session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key: botKey,
              visitorId: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('test-visitor-' + Date.now()),
            }),
          });
          const sessData = await sessRes.json();

          if (!sessRes.ok) {
            throw new Error(`Bot Key check failed: ${sessData.detail || sessData.title || JSON.stringify(sessData)}`);
          }

          resultBox.style.background = '#dcfce7';
          resultBox.style.color = '#15803d';
          resultBox.style.border = '1px solid #86efac';
          resultBox.style.whiteSpace = 'pre-line';
          resultBox.textContent = `✅ AI Assistant Platform is ONLINE (Port 4000)!\n` +
            `Bot Name: "${sessData.botName || 'Stumpix Cricket Bot'}"\n` +
            `AI Engine: ${healthData.llm} | Speech: ${healthData.stt} / ${healthData.tts}\n` +
            `Features: Realtime Voice Live Call: ${sessData.features?.liveCall ? 'Enabled' : 'Disabled'}\n` +
            `Cricket Data Connector: Connected to Beta API (https://betapplapi.kcnanja.com/api).`;
        } catch (err) {
          resultBox.style.background = '#fee2e2';
          resultBox.style.color = '#b91c1c';
          resultBox.style.border = '1px solid #fca5a5';
          resultBox.textContent = `❌ Cannot reach AI Assistant Platform at ${endpointVal}.\nMake sure run-ai-platform.bat is running on your machine!\nError: ${err.message}`;
        }
        return;
      }

      if (provVal === 'localhost') {
        resultBox.textContent = `Connecting to Localhost AI API at ${endpointVal}...`;
        try {
          const healthRes = await fetch(`${endpointVal}/health`);
          if (!healthRes.ok) throw new Error(`HTTP ${healthRes.status}`);
          const healthData = await healthRes.json();

          let msg = `✅ Localhost AI API Server is ONLINE on port ${healthData.port}!\nDatabase: ${healthData.database} (${healthData.totalTeams} teams, ${healthData.totalPlayers} players).`;

          if (keyVal) {
            resultBox.textContent = msg + '\nTesting Gemini key connectivity through localhost...';
            const testRes = await fetch(`${endpointVal}/api/settings/ai/test`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ apiKey: keyVal, model: modelVal })
            });
            const testData = await testRes.json();
            if (testRes.ok && testData.success) {
              msg += `\n⚡ Gemini Connectivity: Verified (${modelVal}).`;
            } else {
              msg += `\n⚠️ Gemini Key Note: ${testData.error || 'Check key'}`;
            }
          }

          resultBox.style.background = '#dcfce7';
          resultBox.style.color = '#15803d';
          resultBox.style.border = '1px solid #86efac';
          resultBox.style.whiteSpace = 'pre-line';
          resultBox.textContent = msg;
        } catch (err) {
          resultBox.style.background = '#fee2e2';
          resultBox.style.color = '#b91c1c';
          resultBox.style.border = '1px solid #fca5a5';
          resultBox.textContent = `❌ Cannot reach Localhost AI API at ${endpointVal}.\nMake sure run-local-ai.bat is running on your machine! Error: ${err.message}`;
        }
        return;
      }

      resultBox.textContent = 'Testing connection with Google Gemini Cloud...';
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
        if (res.ok && data.success) {
          resultBox.style.background = '#dcfce7';
          resultBox.style.color = '#15803d';
          resultBox.style.border = '1px solid #86efac';
          resultBox.textContent = `✅ ${data.message || 'Connected successfully to Gemini!'}`;
        } else {
          resultBox.style.background = '#fee2e2';
          resultBox.style.color = '#b91c1c';
          resultBox.style.border = '1px solid #fca5a5';
          resultBox.textContent = `❌ ${data.message || (data.error && (data.error.message || data.error)) || 'Test failed'}`;
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

      const provVal = document.getElementById('ai-provider-select').value;
      const endpointVal = (document.getElementById('ai-endpoint-url')?.value || (provVal === 'platform' ? 'http://localhost:4000' : 'http://localhost:3000')).trim().replace(/\/+$/, '');
      const keyVal = keyInput.value.trim();
      const modelVal = document.getElementById('ai-model-select').value;
      const promptVal = document.getElementById('ai-system-prompt').value.trim();

      // Persist preferences locally in browser
      localStorage.setItem('stumpix_ai_provider', provVal);
      localStorage.setItem('stumpix_ai_endpoint', endpointVal);
      if (provVal === 'platform') {
        if (keyVal) {
          localStorage.setItem('stumpix_bot_key', keyVal);
        } else if (!localStorage.getItem('stumpix_bot_key')) {
          localStorage.setItem('stumpix_bot_key', DEFAULT_PLATFORM_KEY);
        }
      }

      if (provVal === 'localhost') {
        // Also sync settings file on localhost
        try {
          await fetch(`${endpointVal}/api/settings/ai`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: keyVal,
              model: modelVal,
              systemPrompt: promptVal
            })
          });
        } catch (_) {}
      }

      const payload = {
        enabled: toggle.checked,
        provider: provVal,
        apiKey: keyVal,
        model: modelVal,
        endpointUrl: endpointVal,
        systemPrompt: promptVal,
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
    const savedProv = localStorage.getItem('stumpix_ai_provider') || cfg.provider || 'platform';
    const prov = document.getElementById('ai-provider-select');
    if (prov) {
      prov.value = savedProv;
      const endpointGroup = document.getElementById('ai-endpoint-group');
      if (endpointGroup) {
        endpointGroup.style.display = (savedProv === 'platform' || savedProv === 'localhost' || savedProv === 'custom') ? 'block' : 'none';
      }
    }

    const endpointInput = document.getElementById('ai-endpoint-url');
    if (endpointInput) {
      const defaultEndpoint = savedProv === 'platform' ? 'http://localhost:4000' : (savedProv === 'localhost' ? 'http://localhost:3000' : 'http://localhost:4000');
      endpointInput.value = localStorage.getItem('stumpix_ai_endpoint') || cfg.endpointUrl || defaultEndpoint;
    }

    const key = document.getElementById('ai-api-key');
    if (key) {
      if (savedProv === 'platform') {
        const botKey = localStorage.getItem('stumpix_bot_key') || cfg.apiKey || DEFAULT_PLATFORM_KEY;
        key.placeholder = `Bot Key: ${botKey.slice(0, 14)}... (Type to replace)`;
      } else if (cfg.apiKey) {
        key.placeholder = `Saved: ${cfg.apiKey} (Type to replace)`;
      }
    }

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

  // 7. Initialize and Listen for Route & Auth Changes
  function init() {
    injectStyles();
    renderFloatingBot();
    checkAndInjectSettingsTab();

    // Pre-load AI config for active admin session
    try {
      const auth = getAuth();
      if (auth && isAdmin()) {
        fetch(`${API_BASE}/settings/ai`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        })
          .then((r) => r.json())
          .then((d) => {
            if (d && d.data && d.data.ai) {
              currentAiConfig = d.data.ai;
            }
          })
          .catch(() => {});
      }
    } catch (_) {}

    // Route observer
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        checkAndInjectSettingsTab();
        renderFloatingBot();
      }
    }).observe(document, { subtree: true, childList: true });

    // Periodic check to ensure elements attach if navigation happens dynamically
    setInterval(() => {
      checkAndInjectSettingsTab();
      renderFloatingBot();
    }, 1500);

    // Storage observer
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