#!/bin/bash
set -e
D=/home/u403881955/domains/betapplapi.kcnanja.com

echo "=== 1. CHECKING SOCKET.IO CORS ==="
grep -rn "cors" "$D" 2>/dev/null | grep -E "socket|io" || true

echo "=== 2. PATCHING app.js IN ALL BETAPPLAPI LOCATIONS ==="
find "$D" -type f -name "app.js" | while read -r f; do
    echo "Patching: $f"
    # Add https://betappl.kcnanja.com and local ports if not present
    if grep -q "'https://ppl.kcnanja.com'" "$f" && ! grep -q "'https://betappl.kcnanja.com'" "$f"; then
        sed -i "s|'https://ppl.kcnanja.com'|'https://betappl.kcnanja.com',\n        'https://ppl.kcnanja.com'|g" "$f"
        echo "  -> Added betappl to $f"
    fi
done

echo "=== 3. PATCHING SOCKET.IO CORS IF ANY ==="
find "$D" -type f \( -name "server.js" -o -name "index.js" -o -name "socket*.js" \) | while read -r f; do
    if grep -q "'https://ppl.kcnanja.com'" "$f" && ! grep -q "'https://betappl.kcnanja.com'" "$f"; then
        sed -i "s|'https://ppl.kcnanja.com'|'https://betappl.kcnanja.com',\n        'https://ppl.kcnanja.com'|g" "$f"
        echo "  -> Added betappl to socket cors in $f"
    fi
done

echo "=== 4. RESTARTING BETAPPLAPI WORKERS ==="
pkill -9 -f "betapplapi.kcnanja.com" || true
mkdir -p "$D/tmp"
touch "$D/tmp/restart.txt"
if [ -d "$D/hbuilds/current/nodejs/tmp" ]; then
    touch "$D/hbuilds/current/nodejs/tmp/restart.txt"
fi

echo "=== 5. VERIFYING app.js CORS BLOCK ==="
grep -n "origin:" -A 10 "$D/hbuilds/current/nodejs/src/app.js" || true

echo "=== CORS FIX COMPLETED ==="
