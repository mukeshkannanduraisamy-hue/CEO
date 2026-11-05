#!/bin/bash
D=/home/u403881955/domains

echo "=== 1. CHECKING UPLOADS DIRECTORIES ==="
for domain in pplapi.kcnanja.com betapplapi.kcnanja.com ppl.kcnanja.com betappl.kcnanja.com; do
    echo "--- $domain ---"
    find "$D/$domain" -maxdepth 3 -type d -name "uploads" 2>/dev/null
done

echo "=== 2. CHECKING EXPRESS STATIC CONFIG IN BACKEND ==="
for domain in pplapi.kcnanja.com betapplapi.kcnanja.com; do
    echo "--- $domain static routes ---"
    grep -rn "express.static" "$D/$domain" 2>/dev/null | head -n 10 || true
    grep -rn "/uploads" "$D/$domain/src" 2>/dev/null | head -n 10 || true
done

echo "=== 3. CHECKING FRONTEND BUILDS (public_html) ==="
echo "ppl.kcnanja.com files:"
ls -lh "$D/ppl.kcnanja.com/public_html" | head -n 15
echo "betappl.kcnanja.com files:"
ls -lh "$D/betappl.kcnanja.com/public_html" | head -n 15

echo "=== 4. CHECKING PASSENGER / NODE PROCESSES ==="
ps aux | grep -E "node|passenger" | grep -v grep || true

echo "=== 5. CHECKING RECENT GIT OR BUILD COMMITS ==="
for domain in ppl.kcnanja.com betappl.kcnanja.com pplapi.kcnanja.com betapplapi.kcnanja.com; do
    if [ -d "$D/$domain/.git" ]; then
        echo "$domain git log: $(git -C "$D/$domain" log -1 --oneline 2>/dev/null)"
    fi
done
