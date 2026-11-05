#!/bin/bash
set -e
AI_DIR=/home/u403881955/domains/kcnanja.com/public_html/ai
mkdir -p "$AI_DIR"
cd "$AI_DIR"

# 1. Download index.php from GitHub
curl -sL https://raw.githubusercontent.com/mukeshkannanduraisamy-hue/CEO/main/hosted_ai_index.php -o "$AI_DIR/index.php"

# 2. Setup .htaccess for CORS and routing
cat << 'EOF' > "$AI_DIR/.htaccess"
RewriteEngine On
<IfModule mod_headers.c>
    Header set Access-Control-Allow-Origin "*"
    Header set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header set Access-Control-Allow-Headers "Content-Type, Authorization, X-Requested-With"
</IfModule>
RewriteCond %{REQUEST_METHOD} OPTIONS
RewriteRule ^(.*)$ index.php [QSA,L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.php [QSA,L]
EOF

# 3. Read DB password from betapplapi .env
API_DIR="/home/u403881955/domains/betapplapi.kcnanja.com/hbuilds/current/nodejs"
if [ -f "$API_DIR/.env" ]; then
    DB_PASS=$(grep '^DB_PASSWORD=' "$API_DIR/.env" | cut -d '=' -f2- | sed -e 's/^[ \t"'\''\r]*//' -e 's/[ \t"'\''\r]*$//')
    DB_USER=$(grep '^DB_USER=' "$API_DIR/.env" | cut -d '=' -f2- | sed -e 's/^[ \t"'\''\r]*//' -e 's/[ \t"'\''\r]*$//')
    DB_NAME="u403881955_betappl"

    cat << EOF > "$AI_DIR/db_config.php"
<?php
return [
    'host' => '127.0.0.1',
    'database' => '$DB_NAME',
    'user' => '$DB_USER',
    'password' => '$DB_PASS'
];
EOF
fi

# 4. Setup default config.json if not present
if [ ! -f "$AI_DIR/config.json" ]; then
    cat << 'EOF' > "$AI_DIR/config.json"
{
  "apiKey": "",
  "model": "gemini-1.5-flash",
  "systemPrompt": "You are the official Stumpix Cricket League AI Assistant for KCN Cricket League 2026. Be friendly, accurate, and concise. Provide verified tournament statistics, player information, team rosters, and match schedules.",
  "enabled": true,
  "temperature": 0.7
}
EOF
fi

chmod 644 "$AI_DIR/index.php" "$AI_DIR/.htaccess" "$AI_DIR/db_config.php" 2>/dev/null || true
chmod 666 "$AI_DIR/config.json" 2>/dev/null || true

echo "=== HOSTED AI DEPLOYED TO $AI_DIR ==="
ls -la "$AI_DIR"
