#!/bin/bash
D=/home/u403881955/domains/betappl.kcnanja.com/public_html

node -e "
const fs = require('fs');
const file = '$D/index.html';
let html = fs.readFileSync(file, 'utf8');

if (!html.includes('beta-sync-widget')) {
  const widget = \`
<!-- Beta Live Sync Floating Button -->
<div id=\"beta-sync-widget\" style=\"position:fixed;bottom:24px;right:24px;z-index:999999;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;\">
  <button id=\"btn-sync-live\" style=\"display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;border:none;padding:10px 18px;border-radius:9999px;font-size:13px;font-weight:700;letter-spacing:0.3px;box-shadow:0 6px 20px rgba(16,185,129,0.45);cursor:pointer;transition:all 0.25s ease;outline:none;\">
    <svg id=\"sync-spin-icon\" style=\"transition:transform 0.5s ease;\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\">
      <path d=\"M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2\"/>
    </svg>
    <span id=\"sync-label\">Sync Live Data</span>
  </button>
  <div id=\"sync-info-toast\" style=\"display:none;margin-top:8px;padding:8px 14px;background:#0f172a;color:#f1f5f9;font-size:12px;font-weight:500;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.3);text-align:center;border:1px solid #334155;\"></div>
</div>
<style>
  @keyframes spinAnimation { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .sync-spinning { animation: spinAnimation 0.8s linear infinite; }
  #btn-sync-live:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(16,185,129,0.55); filter: brightness(1.05); }
  #btn-sync-live:active { transform: translateY(0); }
</style>
<script>
(function() {
  const btn = document.getElementById('btn-sync-live');
  const icon = document.getElementById('sync-spin-icon');
  const label = document.getElementById('sync-label');
  const toast = document.getElementById('sync-info-toast');
  if (!btn) return;

  function showToast(msg, bg) {
    toast.textContent = msg;
    toast.style.background = bg || '#0f172a';
    toast.style.display = 'block';
  }

  btn.addEventListener('click', async function() {
    btn.disabled = true;
    icon.classList.add('sync-spinning');
    label.textContent = 'Syncing...';
    showToast('Syncing all data & media from live...', '#1e293b');

    try {
      const res = await fetch('https://betapplapi.kcnanja.com/api/internal/sync-live?key=kcn-sync-secret-2026', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        label.textContent = 'Synced!';
        showToast('✅ Live data & media synced! Refreshing...', '#065f46');
        setTimeout(() => location.reload(), 1200);
      } else {
        label.textContent = 'Sync Failed';
        showToast('❌ Error: ' + (data.error || data.message), '#991b1b');
        setTimeout(() => { btn.disabled = false; label.textContent = 'Sync Live Data'; icon.classList.remove('sync-spinning'); }, 3000);
      }
    } catch (err) {
      label.textContent = 'Network Error';
      showToast('❌ Failed to reach sync service', '#991b1b');
      setTimeout(() => { btn.disabled = false; label.textContent = 'Sync Live Data'; icon.classList.remove('sync-spinning'); }, 3000);
    }
  });
})();
</script>
\`;
  html = html.replace('</body>', widget + '\n</body>');
  fs.writeFileSync(file, html, 'utf8');
  console.log('Successfully injected sync button into index.html');
} else {
  console.log('Button already present');
}
"
