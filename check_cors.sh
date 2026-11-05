#!/bin/bash
D=/home/u403881955/domains

echo "=== 1. CHECKING CORS IN .env FILES ==="
grep -rn "CORS" "$D/betapplapi.kcnanja.com"/*.env "$D/betapplapi.kcnanja.com/hbuilds"/*/.env 2>/dev/null || true
grep -rn "FRONTEND" "$D/betapplapi.kcnanja.com"/*.env "$D/betapplapi.kcnanja.com/hbuilds"/*/.env 2>/dev/null || true
grep -rn "CLIENT" "$D/betapplapi.kcnanja.com"/*.env "$D/betapplapi.kcnanja.com/hbuilds"/*/.env 2>/dev/null || true

echo "=== 2. CHECKING CORS IN app.js ==="
grep -rn "cors" "$D/betapplapi.kcnanja.com/hbuilds/current/nodejs/src/app.js" -A 10 -B 5 2>/dev/null || true
grep -rn "cors" "$D/pplapi.kcnanja.com/hbuilds/current/nodejs/src/app.js" -A 10 -B 5 2>/dev/null || true
