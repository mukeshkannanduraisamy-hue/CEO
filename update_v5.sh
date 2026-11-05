#!/bin/bash
set -e
TARGET="/home/u403881955/domains/betappl.kcnanja.com/public_html/ai-assistant.js"

curl -sL "https://raw.githubusercontent.com/mukeshkannanduraisamy-hue/CEO/main/ai-part1.js" > "$TARGET"
curl -sL "https://raw.githubusercontent.com/mukeshkannanduraisamy-hue/CEO/main/ai-part2.js" >> "$TARGET"
chmod 644 "$TARGET"

echo "DEPLOY_V5_SUCCESS: Size is $(wc -c < "$TARGET") bytes"
