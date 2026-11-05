#!/bin/bash
D=/home/u403881955/domains

echo "=== 1. CHECKING config/paths.js ==="
for domain in pplapi.kcnanja.com betapplapi.kcnanja.com; do
    echo "--- $domain config/paths.js ---"
    cat "$D/$domain/hbuilds/current/nodejs/src/config/paths.js" 2>/dev/null || cat "$D/$domain/src/config/paths.js" 2>/dev/null || true
done

echo "=== 2. CHECKING API URLS IN ppl.kcnanja.com main bundle ==="
grep -o "https://[a-zA-Z0-9.-]*kcnanja\.com[^\"' )]*" "$D/ppl.kcnanja.com/public_html/"main*.js || true

echo "=== 3. CHECKING FRONTEND REPOS OR BUILDS ==="
find /home/u403881955 -maxdepth 4 -name "package.json" 2>/dev/null

echo "=== 4. CHECKING UPLOADS ON DISK ==="
ls -la /home/u403881955/domains/pplapi.kcnanja.com/storage/uploads/branding/ 2>/dev/null || true
ls -la /home/u403881955/domains/betapplapi.kcnanja.com/storage/uploads/branding/ 2>/dev/null || true
