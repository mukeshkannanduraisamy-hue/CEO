#!/bin/bash
set -e
D=/home/u403881955/domains

echo "=== 1. SYNCING ALL UPLOAD SUBDIRECTORIES ==="
mkdir -p "$D/betapplapi.kcnanja.com/storage/uploads"
cp -r "$D/pplapi.kcnanja.com/storage/uploads"/* "$D/betapplapi.kcnanja.com/storage/uploads/" 2>/dev/null || true
chmod -R 755 "$D/betapplapi.kcnanja.com/storage/uploads"

echo "=== 2. CREATING SYMLINKS FOR STATIC SERVING ==="
# betapplapi
mkdir -p "$D/betapplapi.kcnanja.com/public_html/api"
ln -sfn "$D/betapplapi.kcnanja.com/storage/uploads" "$D/betapplapi.kcnanja.com/public_html/uploads"
ln -sfn "$D/betapplapi.kcnanja.com/storage/uploads" "$D/betapplapi.kcnanja.com/public_html/api/uploads"

# betappl
mkdir -p "$D/betappl.kcnanja.com/public_html/api"
ln -sfn "$D/betapplapi.kcnanja.com/storage/uploads" "$D/betappl.kcnanja.com/public_html/uploads"
ln -sfn "$D/betapplapi.kcnanja.com/storage/uploads" "$D/betappl.kcnanja.com/public_html/api/uploads"

echo "=== 3. CHECKING & PATCHING app.js FOR /api/uploads ==="
find "$D/betapplapi.kcnanja.com" -type f -name "app.js" | while read -r f; do
    echo "Checking: $f"
    if ! grep -q "express.static(UPLOADS_DIR" "$f" | grep -q "/api/uploads"; then
        sed -i "s|app.use('/uploads', express.static(UPLOADS_DIR|app.use('/api/uploads', express.static(UPLOADS_DIR, { maxAge: '1d', etag: true }));\napp.use('/uploads', express.static(UPLOADS_DIR|g" "$f"
        echo "  -> Added /api/uploads static route to $f"
    fi
done

echo "=== 4. RESTARTING BETAPPLAPI WORKERS ==="
pkill -9 -f "betapplapi.kcnanja.com" || true
mkdir -p "$D/betapplapi.kcnanja.com/tmp"
touch "$D/betapplapi.kcnanja.com/tmp/restart.txt"

echo "=== 5. CHECKING DIRECTORIES ON DISK ==="
echo "PPL uploads tree:"
find "$D/pplapi.kcnanja.com/storage/uploads" -maxdepth 2 -type d
echo "BETAPPL uploads tree:"
find "$D/betapplapi.kcnanja.com/storage/uploads" -maxdepth 2 -type d

echo "=== PHOTOS FIX COMPLETE ==="
