#!/bin/bash
set -e
F=/home/u403881955/domains/betappl.kcnanja.com/public_html
curl -sL https://raw.githubusercontent.com/mukeshkannanduraisamy-hue/CEO/main/ai-assistant-v4.js -o "$F/ai-assistant.js"
chmod 644 "$F/ai-assistant.js"
echo "ai-assistant.js updated to v4 successfully. Size: $(wc -c < "$F/ai-assistant.js")"
