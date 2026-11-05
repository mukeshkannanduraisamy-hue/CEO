#!/bin/bash
D=/home/u403881955/domains/betapplapi.kcnanja.com/hbuilds/current/nodejs
S="$D/src"

echo "=== 1. SAMPLE CONTROLLER ==="
cat "$S/controllers/sample.controller.js" 2>/dev/null || true

echo "=== 2. SETTINGS CONTROLLER ==="
cat "$S/controllers/settings.controller.js" 2>/dev/null || true

echo "=== 3. RBAC MIDDLEWARE ==="
cat "$S/middlewares/rbac.middleware.js" 2>/dev/null || true

echo "=== 4. USER MODEL & ROLES ==="
cat "$S/models/user.model.js" 2>/dev/null || true

echo "=== 5. CHECK AI SETTINGS / GEMINI IN CODE ==="
grep -rn "gemini" "$S" 2>/dev/null || true
