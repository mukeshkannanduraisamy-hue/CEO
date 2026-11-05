#!/bin/bash
D=/home/u403881955/domains/betapplapi.kcnanja.com/hbuilds/current/nodejs

echo "=== CHECK NODE ERROR LOGS ==="
find "$D" -name "*.log" -exec tail -n 20 {} + 2>/dev/null || true
tail -n 30 /home/u403881955/.passenger/native_support/* 2>/dev/null || true

echo "=== CHECK SYNTAX OF FILES ==="
# Check syntax with node if we find it
NODE_BIN=$(find /opt -name "node" 2>/dev/null | grep -E "bin/node$" | head -n 1)
echo "Node binary: $NODE_BIN"
if [ -n "$NODE_BIN" ]; then
  "$NODE_BIN" -c "$D/src/models/ai-settings.model.js" && echo "ai-settings.model.js syntax OK"
  "$NODE_BIN" -c "$D/src/services/ai-config.service.js" && echo "ai-config.service.js syntax OK"
  "$NODE_BIN" -c "$D/src/controllers/settings.controller.js" && echo "settings.controller.js syntax OK"
  "$NODE_BIN" -c "$D/src/routes/settings.routes.js" && echo "settings.routes.js syntax OK"
fi
