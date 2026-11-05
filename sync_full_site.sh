#!/bin/bash
set -e
D=/home/u403881955/domains

echo "=== 1. BACKING UP CURRENT BETAPPL FRONTEND ==="
if [ ! -d "$D/betappl.kcnanja.com/public_html_backup" ]; then
    cp -r "$D/betappl.kcnanja.com/public_html" "$D/betappl.kcnanja.com/public_html_backup"
    echo "Backed up old betappl frontend."
fi

echo "=== 2. COPYING LATEST FRONTEND FROM PPL TO BETAPPL ==="
cp -r "$D/ppl.kcnanja.com/public_html"/* "$D/betappl.kcnanja.com/public_html/"
chmod -R 755 "$D/betappl.kcnanja.com/public_html"

echo "=== 3. REPLACING API ENDPOINTS IN BETAPPL FRONTEND ==="
for f in "$D/betappl.kcnanja.com/public_html"/main*.js "$D/betappl.kcnanja.com/public_html"/chunk*.js "$D/betappl.kcnanja.com/public_html"/index.html; do
    if [ -f "$f" ]; then
        sed -i 's|https://pplapi.kcnanja.com|https://betapplapi.kcnanja.com|g' "$f"
    fi
done
echo "API endpoints replaced in betappl frontend."

echo "=== 4. SYNCING UPLOADS & CREATING STATIC SYMLINKS ==="
mkdir -p "$D/betapplapi.kcnanja.com/storage/uploads"
cp -rn "$D/pplapi.kcnanja.com/storage/uploads"/* "$D/betapplapi.kcnanja.com/storage/uploads/" 2>/dev/null || true
chmod -R 755 "$D/betapplapi.kcnanja.com/storage/uploads"

# Create symlinks in public_html for direct static serving
ln -sfn "$D/betapplapi.kcnanja.com/storage/uploads" "$D/betapplapi.kcnanja.com/public_html/uploads"
ln -sfn "$D/betapplapi.kcnanja.com/storage/uploads" "$D/betappl.kcnanja.com/public_html/uploads"

echo "=== 5. RESTARTING BETAPPLAPI LSNODE PROCESSES ==="
pkill -9 -f "betapplapi.kcnanja.com" || true
mkdir -p "$D/betapplapi.kcnanja.com/tmp"
touch "$D/betapplapi.kcnanja.com/tmp/restart.txt"

echo "=== 6. VERIFYING BETAPPL FRONTEND FILES ==="
ls -lh "$D/betappl.kcnanja.com/public_html" | head -n 10
grep -o "https://[a-zA-Z0-9.-]*kcnanja\.com[^\"' )]*" "$D/betappl.kcnanja.com/public_html/"main*.js || true

echo "=== FULL SYNC COMPLETED SUCCESSFULLY ==="
