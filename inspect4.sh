#!/bin/bash
D=/home/u403881955/domains/betapplapi.kcnanja.com/hbuilds/current/nodejs
S="$D/src"
F=/home/u403881955/domains/betappl.kcnanja.com/public_html

echo "=== 1. MESSAGING CONFIG SERVICE ==="
cat "$S/services/messaging-config.service.js" 2>/dev/null || true

echo "=== 2. FIND SETTINGS CHUNKS IN FRONTEND ==="
grep -rn "Messaging" "$F"/chunk-*.js 2>/dev/null | head -n 5 || true
grep -rn "Razorpay" "$F"/chunk-*.js 2>/dev/null | head -n 5 || true
