#!/bin/bash
set -e
D=/home/u403881955/domains

echo "=== 1. CREATING /home/u403881955/sync_live_to_beta.sh ==="
cat << 'EOF' > /home/u403881955/sync_live_to_beta.sh
#!/bin/bash
set -e
exec 200>/tmp/live_to_beta_sync.lock
flock -n 200 || { echo "Sync already in progress, skipping."; exit 0; }

D=/home/u403881955/domains
PPL_ENV="$D/pplapi.kcnanja.com/hbuilds/config/.env"
BETA_ENV="$D/betapplapi.kcnanja.com/hbuilds/config/.env"

clean_val() {
    echo "$1" | sed -e "s/^[ \t'\"]*//" -e "s/[ \t'\"]*$//" | tr -d '\r'
}
get_env_val() {
    clean_val "$(grep -E "^${2}=" "$1" | head -n 1 | cut -d '=' -f2-)"
}

SRC_USER=$(get_env_val "$PPL_ENV" "DB_USER")
SRC_PASS=$(get_env_val "$PPL_ENV" "DB_PASSWORD")
SRC_DB=$(get_env_val "$PPL_ENV" "DB_NAME")
SRC_HOST="srv1497.hstgr.io"

DST_USER=$(get_env_val "$BETA_ENV" "DB_USER")
DST_PASS=$(get_env_val "$BETA_ENV" "DB_PASSWORD")
DST_DB=$(get_env_val "$BETA_ENV" "DB_NAME")
DST_HOST="127.0.0.1"

# 1. Database sync
mysqldump -h "$SRC_HOST" -u "$SRC_USER" -p"$SRC_PASS" --single-transaction --quick --routines --triggers "$SRC_DB" > /tmp/ppl_live_sync.sql
mysql -h "$DST_HOST" -u "$DST_USER" -p"$DST_PASS" "$DST_DB" < /tmp/ppl_live_sync.sql
rm -f /tmp/ppl_live_sync.sql

# 2. Incremental media sync
mkdir -p "$D/betapplapi.kcnanja.com/storage/uploads"
cp -ru "$D/pplapi.kcnanja.com/storage/uploads"/* "$D/betapplapi.kcnanja.com/storage/uploads/" 2>/dev/null || true
chmod -R 755 "$D/betapplapi.kcnanja.com/storage/uploads"

# 3. Static symlinks
mkdir -p "$D/betapplapi.kcnanja.com/public_html/api" "$D/betappl.kcnanja.com/public_html/api"
ln -sfn "$D/betapplapi.kcnanja.com/storage/uploads" "$D/betapplapi.kcnanja.com/public_html/uploads"
ln -sfn "$D/betapplapi.kcnanja.com/storage/uploads" "$D/betapplapi.kcnanja.com/public_html/api/uploads"
ln -sfn "$D/betapplapi.kcnanja.com/storage/uploads" "$D/betappl.kcnanja.com/public_html/uploads"
ln -sfn "$D/betapplapi.kcnanja.com/storage/uploads" "$D/betappl.kcnanja.com/public_html/api/uploads"

# 4. Record timestamp
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" > "$D/betapplapi.kcnanja.com/storage/last_sync.txt"
chmod 644 "$D/betapplapi.kcnanja.com/storage/last_sync.txt"
echo "Live to Beta sync completed at $(date -u)"
EOF

chmod +x /home/u403881955/sync_live_to_beta.sh

echo "=== 2. ADDING /api/internal/sync-live ENDPOINT TO app.js ==="
SYNC_CODE=$(cat << 'EOF'

// --- LIVE TO BETA SYNC ENDPOINT ---
const { exec: execSyncCmd } = require('child_process');
app.all('/api/internal/sync-live', (req, res) => {
    const key = req.query.key || (req.body && req.body.key) || req.headers['x-sync-key'];
    if (key !== 'kcn-sync-secret-2026') {
        return res.status(401).json({ success: false, message: 'Invalid or missing sync key' });
    }
    execSyncCmd('/bin/bash /home/u403881955/sync_live_to_beta.sh', { timeout: 120000 }, (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ success: false, error: err.message, stderr });
        }
        let lastSync = new Date().toISOString();
        try {
            lastSync = require('fs').readFileSync('/home/u403881955/domains/betapplapi.kcnanja.com/storage/last_sync.txt', 'utf8').trim();
        } catch (_) {}
        res.json({
            success: true,
            message: 'Incremental sync of data & media completed successfully',
            lastSync,
            timestamp: new Date().toISOString()
        });
    });
});
app.get('/api/internal/sync-status', (req, res) => {
    let lastSync = 'never';
    try {
        lastSync = require('fs').readFileSync('/home/u403881955/domains/betapplapi.kcnanja.com/storage/last_sync.txt', 'utf8').trim();
    } catch (_) {}
    res.json({ success: true, lastSync, timestamp: new Date().toISOString() });
});
// --- END SYNC ENDPOINT ---
EOF
)

find "$D/betapplapi.kcnanja.com" -type f -name "app.js" | while read -r f; do
    if ! grep -q "sync-live" "$f"; then
        # Append before module.exports
        sed -i "/module.exports/i \\$SYNC_CODE" "$f" 2>/dev/null || echo "$SYNC_CODE" >> "$f"
        echo "Added sync-live route to $f"
    fi
done

echo "=== 3. RESTARTING BETAPPLAPI WORKERS ==="
pkill -9 -f "betapplapi.kcnanja.com" || true
mkdir -p "$D/betapplapi.kcnanja.com/tmp"
touch "$D/betapplapi.kcnanja.com/tmp/restart.txt"

echo "=== 4. TESTING SYNC SCRIPT DIRECTLY ==="
/bin/bash /home/u403881955/sync_live_to_beta.sh

echo "=== 5. INJECTING SYNC BUTTON INTO BETAPPL FRONTEND ==="
INDEX_FILE="$D/betappl.kcnanja.com/public_html/index.html"
if ! grep -q "beta-sync-widget" "$INDEX_FILE"; then
    BUTTON_HTML=$(cat << 'EOF'
<!-- Beta Live Sync Floating Button -->
<div id="beta-sync-widget" style="position:fixed;bottom:24px;right:24px;z-index:999999;font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">
  <button id="btn-sync-live" style="display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#059669,#10b981);color:#ffffff;border:none;padding:10px 18px;border-radius:9999px;font-size:13px;font-weight:700;letter-spacing:0.3px;box-shadow:0 6px 20px rgba(16,185,129,0.45);cursor:pointer;transition:all 0.25s ease;outline:none;">
    <svg id="sync-spin-icon" style="transition:transform 0.5s ease;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
    </svg>
    <span id="sync-label">Sync Live Data</span>
  </button>
  <div id="sync-info-toast" style="display:none;margin-top:8px;padding:8px 14px;background:#0f172a;color:#f1f5f9;font-size:12px;font-weight:500;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.3);text-align:center;border:1px solid #334155;"></div>
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
EOF
)
    # Insert before </body>
    sed -i "s|</body>|$BUTTON_HTML\n</body>|g" "$INDEX_FILE"
    echo "Sync button injected into index.html"
fi

echo "=== SETUP AUTO SYNC COMPLETED SUCCESSFULLY ==="
