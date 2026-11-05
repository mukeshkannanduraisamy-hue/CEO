#!/bin/bash
D=/home/u403881955/domains/betapplapi.kcnanja.com/hbuilds/current/nodejs/src

echo "=== 1. SETTINGS ROUTES ==="
cat "$D/routes/settings.routes.js" 2>/dev/null || cat "$D/routes/setting.routes.js" 2>/dev/null || true

echo "=== 2. APP SETTINGS MODEL ==="
cat "$D/models/app-settings.model.js" 2>/dev/null || cat "$D/models/app-setting.model.js" 2>/dev/null || true

echo "=== 3. AUTH / ROLE MIDDLEWARE ==="
grep -rn "Role" "$D/middlewares" 2>/dev/null || grep -rn "admin" "$D/middlewares" 2>/dev/null || true
