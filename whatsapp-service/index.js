'use strict';
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode  = require('qrcode');
const express = require('express');
const cors    = require('cors');
const { randomUUID } = require('crypto');
const fs      = require('fs');
const path    = require('path');
const { execSync } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Config ─────────────────────────────────────────────────────────────────────
const SESSION_PATH    = path.resolve('./.wa_session');
const CAMPAIGNS_FILE  = path.resolve('./campaigns.json');
const BLACKLIST_FILE  = path.resolve('./wa_blacklist.json');
const PORT            = 3001;
const MAX_QR_RETRIES  = 5;   // Give up after 5 QR timeouts, clear session and restart
const QR_TIMEOUT_MS   = 60_000; // 60s per QR

// ── Campaign persistence ───────────────────────────────────────────────────────
function loadCampaigns() {
  try {
    if (fs.existsSync(CAMPAIGNS_FILE)) {
      return JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf8'));
    }
  } catch { /* ignore corrupt file */ }
  return {};
}

function saveCampaigns(campaigns) {
  try {
    // Don't save contacts — too large, not needed after dispatch
    const slim = {};
    for (const [id, c] of Object.entries(campaigns)) {
      const { contacts: _c, ...rest } = c;
      slim[id] = rest;
    }
    fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(slim, null, 2));
  } catch (e) { console.error('[WA] Failed to save campaigns:', e.message); }
}

function loadBlacklist() {
  try {
    if (fs.existsSync(BLACKLIST_FILE)) {
      return new Set(JSON.parse(fs.readFileSync(BLACKLIST_FILE, 'utf8')));
    }
  } catch { /* ignore */ }
  return new Set();
}

function saveBlacklist(blacklistSet) {
  try {
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(Array.from(blacklistSet), null, 2));
  } catch (e) { console.error('[WA] Failed to save blacklist:', e.message); }
}

// ── State ──────────────────────────────────────────────────────────────────────
let qrImageData   = null;
let clientStatus  = 'initializing';
let waClient      = null;
let isInitializing = false;
let qrRetries     = 0;
let qrTimer       = null;
const campaigns   = loadCampaigns();
const blacklist   = loadBlacklist();

// ── Zombie Chrome Killer ───────────────────────────────────────────────────────
function killZombieChrome() {
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
    } else {
      execSync('pkill -f "chrome.*wa_session" || true', { stdio: 'ignore' });
    }
    console.log('[WA] Zombie Chrome processes killed.');
  } catch { /* ignore */ }
}

function clearSession() {
  try {
    if (fs.existsSync(SESSION_PATH)) {
      fs.rmSync(SESSION_PATH, { recursive: true, force: true, maxRetries: 10, retryDelay: 1000 });
      console.log('[WA] Session cleared.');
    }
  } catch (e) { console.error('[WA] Failed to clear session:', e.message); }
}

// ── WhatsApp Client ────────────────────────────────────────────────────────────
function initClient(forceNewSession = false) {
  if (isInitializing) return;
  isInitializing = true;

  // Cleanup previous instance
  if (qrTimer) { clearTimeout(qrTimer); qrTimer = null; }
  if (waClient) {
    try { waClient.destroy(); } catch { /* ignore */ }
    waClient = null;
  }

  // Kill any zombie Chrome process that might be holding the session lock
  killZombieChrome();

  if (forceNewSession) {
    clearSession();
    qrRetries = 0;
  }

  console.log('[WA] Initializing client...');
  clientStatus = 'initializing';
  qrImageData  = null;

  waClient = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    puppeteer: {
      headless: true,
      executablePath: process.env.CHROME_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--no-first-run',
        '--no-zygote',
        '--single-process',      // Important for low-memory EC2 instances
      ],
    },
  });

  // ── QR code handler ──────────────────────────────────────────────────────────
  waClient.on('qr', async (qr) => {
    qrRetries++;
    console.log(`[WA] QR generated (attempt ${qrRetries}/${MAX_QR_RETRIES}) — scan to connect.`);

    // Start a timeout — if not scanned in QR_TIMEOUT_MS, regenerate
    if (qrTimer) clearTimeout(qrTimer);
    qrTimer = setTimeout(() => {
      console.log('[WA] QR not scanned in time.');
      if (qrRetries >= MAX_QR_RETRIES) {
        console.log('[WA] Max QR retries reached — clearing session and starting fresh.');
        isInitializing = false;
        initClient(true); // force new session
      }
      // else whatsapp-web.js will emit another 'qr' automatically
    }, QR_TIMEOUT_MS);

    clientStatus = 'qr_ready';
    isInitializing = false;
    try {
      qrImageData = await qrcode.toDataURL(qr);
    } catch (e) {
      console.error('[WA] QR render error:', e.message);
    }
  });

  waClient.on('authenticated', () => {
    if (qrTimer) { clearTimeout(qrTimer); qrTimer = null; }
    qrRetries = 0;
    clientStatus = 'authenticated';
    qrImageData  = null;
    console.log('[WA] Authenticated!');
  });

  waClient.on('ready', () => {
    isInitializing = false;
    clientStatus   = 'ready';
    console.log('[WA] Client ready — WhatsApp connected.');
  });

  waClient.on('auth_failure', (msg) => {
    console.error('[WA] Auth failure:', msg);
    clientStatus   = 'disconnected';
    isInitializing = false;
    // Auth failure usually means the session is invalid — clear it
    setTimeout(() => initClient(true), 5000);
  });

  waClient.on('disconnected', (reason) => {
    console.log('[WA] Disconnected:', reason);
    isInitializing = false;
    clientStatus   = 'disconnected';
    qrImageData    = null;
    if (qrTimer) { clearTimeout(qrTimer); qrTimer = null; }
    // If server kicked us (LOGOUT), clear session
    const forceNew = reason === 'LOGOUT';
    setTimeout(() => initClient(forceNew), 5000);
  });

  waClient.initialize().catch(err => {
    console.error('[WA] Init error:', err.message);
    isInitializing = false;
    clientStatus   = 'disconnected';
    // If Chrome can't start, kill zombies and retry
    if (err.message.includes('already running') || err.message.includes('ETXTBSY')) {
      killZombieChrome();
      clearSession();
    }
    setTimeout(() => initClient(false), 8000);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function sanitizePhone(phone) {
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('0') && digits.length === 11) digits = '91' + digits.slice(1);
  if (digits.length === 10) digits = '91' + digits;
  if (digits.length < 10) return null;
  return digits + '@c.us';
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function buildMedia(attachment) {
  if (!attachment) return null;
  try {
    return new MessageMedia(attachment.mimetype, attachment.data, attachment.filename);
  } catch (e) {
    console.error('[WA] Failed to build media:', e.message);
    return null;
  }
}

// ── Campaign Runner ────────────────────────────────────────────────────────────
async function runCampaign(campaignId, contacts, template, attachment, delayMs) {
  const camp = campaigns[campaignId];
  if (!camp) return;
  camp.status = 'running';
  saveCampaigns(campaigns);

  const media = buildMedia(attachment);
  let processedCount = 0;

  for (const contact of contacts) {
    if (camp.status === 'cancelled') break;

    // Verify WA is still connected before each send
    if (clientStatus !== 'ready') {
      console.log('[WA] Client not ready — pausing campaign until reconnected...');
      let waited = 0;
      while (clientStatus !== 'ready' && waited < 60000) {
        await sleep(2000);
        waited += 2000;
      }
      if (clientStatus !== 'ready') {
        camp.status = 'paused';
        console.error('[WA] Campaign paused — WhatsApp disconnected for >60s');
        saveCampaigns(campaigns);
        return;
      }
    }

    const rawPhone = contact.Phone || contact.phone || contact.Number || contact.number
                   || contact.Mobile || contact.mobile || contact.WhatsApp || contact.whatsapp || '';

    if (!rawPhone) {
      camp.failed++;
      camp.errors.push('Empty phone field');
      continue;
    }

    const waId = sanitizePhone(rawPhone);
    if (!waId) {
      camp.failed++;
      camp.errors.push(`Invalid: ${rawPhone}`);
      continue;
    }

    if (blacklist.has(waId)) {
      camp.failed++;
      camp.errors.push(`Blacklisted: ${rawPhone}`);
      continue;
    }

    // Personalize message
    let msg = template;
    for (const [col, val] of Object.entries(contact)) {
      msg = msg.replaceAll(`{${col}}`, val ?? '');
    }

    try {
      if (media) {
        await waClient.sendMessage(waId, media, { caption: msg });
      } else {
        await waClient.sendMessage(waId, msg);
      }
      camp.sent++;
      processedCount++;
      console.log(`[WA][${campaignId}] ✓ ${rawPhone}`);
    } catch (err) {
      camp.failed++;
      camp.errors.push(String(rawPhone));
      console.error(`[WA][${campaignId}] ✗ ${rawPhone}:`, err.message);
      
      // Auto-blacklist numbers that fail with specific errors to protect account
      if (err.message.includes('invalid') || err.message.includes('not exists')) {
         blacklist.add(waId);
         saveBlacklist(blacklist);
         console.log(`[WA] Auto-blacklisted ${rawPhone} due to hard failure.`);
      }
    }

    // Update ETA
    const processed = camp.sent + camp.failed;
    const remaining = camp.total - processed;
    const elapsed   = Date.now() - new Date(camp.started_at).getTime();
    camp.eta_seconds = remaining > 0 && processed > 0
      ? Math.round((elapsed / processed) * remaining / 1000)
      : 0;

    // Persist progress every 10 sends
    if (processed % 10 === 0) saveCampaigns(campaigns);

    // ── Anti-Ban Delay Logic ──
    if (processedCount > 0 && processedCount % 15 === 0) {
      // Burst pause: Long human-like break every 15 successful messages
      const burstPause = Math.floor(Math.random() * (120000 - 60000 + 1)) + 60000; // 60s - 120s
      console.log(`[WA] Anti-ban: Burst pause for ${Math.round(burstPause/1000)}s...`);
      await sleep(burstPause);
    } else {
      // Normal delay with ±20% random jitter to simulate human typing
      const jitter = delayMs * (0.8 + (Math.random() * 0.4)); 
      await sleep(jitter);
    }
  }

  camp.status      = camp.status === 'cancelled' ? 'cancelled' : 'completed';
  camp.finished_at = new Date().toISOString();
  camp.eta_seconds = 0;
  saveCampaigns(campaigns);
  console.log(`[WA] Campaign ${campaignId} done — ${camp.sent} sent, ${camp.failed} failed.`);
}

// ── API Routes ─────────────────────────────────────────────────────────────────

// Health check (for load balancers / pm2 health)
app.get('/health', (_req, res) => res.json({ ok: true, status: clientStatus }));

// Status + QR
app.get('/status', (_req, res) => {
  res.json({
    status: clientStatus,
    qr:     clientStatus === 'qr_ready' ? qrImageData : null,
  });
});

// Force re-init (useful from UI if stuck)
app.post('/reinit', (_req, res) => {
  console.log('[WA] Manual re-init triggered via API.');
  isInitializing = false;
  setTimeout(() => initClient(false), 500);
  res.json({ status: 'reinitializing' });
});

// Campaigns list
app.get('/campaigns', (_req, res) => {
  const list = Object.entries(campaigns)
    .map(([id, c]) => ({
      id,
      type:           c.type || 'bulk',
      total:          c.total,
      sent:           c.sent,
      failed:         c.failed,
      errors:         c.errors?.slice(-20) ?? [],
      status:         c.status,
      started_at:     c.started_at,
      finished_at:    c.finished_at,
      preview:        c.preview,
      has_attachment: c.has_attachment,
      eta_seconds:    c.eta_seconds || 0,
    }))
    .reverse();
  res.json({ campaigns: list });
});

// Test — single message
app.post('/test', async (req, res) => {
  if (clientStatus !== 'ready') {
    return res.status(503).json({ error: 'WhatsApp not connected. Scan the QR code first.' });
  }
  const { phone, message, attachment } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'phone and message are required.' });
  }
  const waId = sanitizePhone(phone);
  if (!waId) return res.status(400).json({ error: `Invalid phone number: ${phone}` });

  try {
    const media = buildMedia(attachment);
    if (media) {
      await waClient.sendMessage(waId, media, { caption: message });
    } else {
      await waClient.sendMessage(waId, message);
    }
    res.json({ status: 'sent', to: phone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start bulk campaign
app.post('/send', async (req, res) => {
  if (clientStatus !== 'ready') {
    return res.status(503).json({ error: 'WhatsApp not connected. Scan the QR code first.' });
  }
  const { contacts, message, attachment, delay_seconds } = req.body;

  if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: 'No contacts provided.' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (contacts.length > 250) {
    return res.status(400).json({ error: 'Max 250 contacts per campaign. Split into smaller batches.' });
  }

  // Clamp delay: min 8s, max 30s to stay safe
  const delayMs    = Math.max(8000, Math.min(30000, (delay_seconds || 12) * 1000));
  const campaignId = randomUUID();

  campaigns[campaignId] = {
    total:          contacts.length,
    sent:           0,
    failed:         0,
    errors:         [],
    status:         'queued',
    started_at:     new Date().toISOString(),
    finished_at:    null,
    preview:        message.slice(0, 100),
    has_attachment: !!attachment,
    eta_seconds:    Math.round((contacts.length * delayMs) / 1000),
  };
  saveCampaigns(campaigns);

  // Run async — don't await
  runCampaign(campaignId, contacts, message, attachment || null, delayMs).catch(err => {
    console.error(`[WA] Campaign ${campaignId} crashed:`, err.message);
    if (campaigns[campaignId]) {
      campaigns[campaignId].status = 'failed';
      saveCampaigns(campaigns);
    }
  });

  res.json({ campaign_id: campaignId, total: contacts.length, status: 'queued' });
});

// ── Get all WhatsApp groups ────────────────────────────────────────────────────
app.get('/groups', async (_req, res) => {
  if (clientStatus !== 'ready') {
    return res.status(503).json({ error: 'WhatsApp not connected. Scan the QR code first.' });
  }
  try {
    const chats  = await waClient.getChats();
    const groups = chats
      .filter(c => c.isGroup)
      .map(g => ({
        id:           g.id._serialized,
        name:         g.name || 'Unnamed Group',
        participants: g.participants?.length ?? 0,
        timestamp:    g.timestamp ?? 0,
      }))
      .sort((a, b) => b.timestamp - a.timestamp); // most recently active first
    res.json({ groups });
  } catch (err) {
    console.error('[WA] Failed to fetch groups:', err.message);
    res.status(500).json({ error: 'Failed to fetch groups: ' + err.message });
  }
});

// ── Group Campaign Runner ──────────────────────────────────────────────────────
async function runGroupCampaign(campaignId, groupIds, message, attachment) {
  const camp = campaigns[campaignId];
  if (!camp) return;
  camp.status = 'running';
  saveCampaigns(campaigns);

  const media = buildMedia(attachment);

  for (const groupId of groupIds) {
    if (camp.status === 'cancelled') break;

    // Verify WA is still connected
    if (clientStatus !== 'ready') {
      let waited = 0;
      while (clientStatus !== 'ready' && waited < 60000) {
        await sleep(2000);
        waited += 2000;
      }
      if (clientStatus !== 'ready') {
        camp.status = 'paused';
        saveCampaigns(campaigns);
        console.error('[WA] Group campaign paused — WhatsApp disconnected.');
        return;
      }
    }

    try {
      if (media) {
        await waClient.sendMessage(groupId, media, { caption: message });
      } else {
        await waClient.sendMessage(groupId, message);
      }
      camp.sent++;
      console.log(`[WA][group][${campaignId}] ✓ ${groupId}`);
    } catch (err) {
      camp.failed++;
      camp.errors.push(groupId);
      console.error(`[WA][group][${campaignId}] ✗ ${groupId}:`, err.message);
    }

    // ETA update
    const processed   = camp.sent + camp.failed;
    const remaining   = camp.total - processed;
    const elapsed     = Date.now() - new Date(camp.started_at).getTime();
    camp.eta_seconds  = remaining > 0 && processed > 0
      ? Math.round((elapsed / processed) * remaining / 1000) : 0;

    saveCampaigns(campaigns);

    // 4–8s random delay between group sends (avoids spam detection)
    const delay = 4000 + Math.floor(Math.random() * 4000);
    await sleep(delay);
  }

  camp.status      = camp.status === 'cancelled' ? 'cancelled' : 'completed';
  camp.finished_at = new Date().toISOString();
  camp.eta_seconds = 0;
  saveCampaigns(campaigns);
  console.log(`[WA] Group campaign ${campaignId} done — ${camp.sent} sent, ${camp.failed} failed.`);
}

// ── Send message to selected groups ───────────────────────────────────────────
app.post('/groups/send', async (req, res) => {
  if (clientStatus !== 'ready') {
    return res.status(503).json({ error: 'WhatsApp not connected. Scan the QR code first.' });
  }
  const { group_ids, message, attachment } = req.body;

  if (!group_ids || !Array.isArray(group_ids) || group_ids.length === 0) {
    return res.status(400).json({ error: 'No groups selected.' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (group_ids.length > 50) {
    return res.status(400).json({ error: 'Max 50 groups per campaign.' });
  }

  const campaignId = randomUUID();
  campaigns[campaignId] = {
    type:           'group',
    total:          group_ids.length,
    sent:           0,
    failed:         0,
    errors:         [],
    status:         'queued',
    started_at:     new Date().toISOString(),
    finished_at:    null,
    preview:        message.slice(0, 100),
    has_attachment: !!attachment,
    eta_seconds:    group_ids.length * 6,
  };
  saveCampaigns(campaigns);

  runGroupCampaign(campaignId, group_ids, message, attachment || null).catch(err => {
    console.error(`[WA] Group campaign ${campaignId} crashed:`, err.message);
    if (campaigns[campaignId]) {
      campaigns[campaignId].status = 'failed';
      saveCampaigns(campaigns);
    }
  });

  res.json({ campaign_id: campaignId, total: group_ids.length, status: 'queued' });
});

// Cancel campaign
app.post('/campaigns/:id/cancel', (req, res) => {
  const camp = campaigns[req.params.id];
  if (!camp) return res.status(404).json({ error: 'Campaign not found' });
  if (camp.status !== 'running' && camp.status !== 'queued') {
    return res.status(400).json({ error: `Campaign is already ${camp.status}.` });
  }
  camp.status = 'cancelled';
  saveCampaigns(campaigns);
  res.json({ status: 'cancelled' });
});

// Delete campaign
app.delete('/campaigns/:id', (req, res) => {
  delete campaigns[req.params.id];
  saveCampaigns(campaigns);
  res.json({ status: 'deleted' });
});

// Logout / reconnect
app.post('/logout', async (req, res) => {
  try { await waClient?.logout(); } catch { /* ignore */ }
  try { await waClient?.destroy(); } catch { /* ignore */ }
  waClient       = null;
  clientStatus   = 'disconnected';
  qrImageData    = null;
  isInitializing = false;
  res.json({ status: 'logged_out' });
  setTimeout(() => initClient(true), 2000);
});

// ── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[WA Service] Running on http://localhost:${PORT}`);
  initClient(false);
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  console.log('[WA] SIGTERM received — shutting down gracefully...');
  try { await waClient?.destroy(); } catch { /* ignore */ }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[WA] SIGINT received — shutting down gracefully...');
  try { await waClient?.destroy(); } catch { /* ignore */ }
  process.exit(0);
});
