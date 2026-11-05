#!/bin/bash
D=/home/u403881955/domains/betapplapi.kcnanja.com/hbuilds/current/nodejs
S="$D/src"
LOG=/home/u403881955/inspect_output.txt

exec > "$LOG" 2>&1

echo "=== 1. ROUTES LIST ==="
ls -la "$S/routes"

echo "=== 2. ROUTES INDEX ==="
cat "$S/routes/index.js"

echo "=== 3. SETTINGS ROUTES ==="
for f in "$S"/routes/*setting*; do
  if [ -f "$f" ]; then
    echo "--- File: $f ---"
    cat "$f"
  fi
done

echo "=== 4. MODELS LIST ==="
ls -la "$S/models"

echo "=== 5. SETTINGS MODEL ==="
for f in "$S"/models/*setting*; do
  if [ -f "$f" ]; then
    echo "--- File: $f ---"
    cat "$f"
  fi
done

echo "=== 6. MIDDLEWARES LIST ==="
ls -la "$S/middlewares"

echo "=== 7. AUTH MIDDLEWARE ==="
for f in "$S"/middlewares/*auth* "$S"/middlewares/*role* "$S"/middlewares/*admin*; do
  if [ -f "$f" ]; then
    echo "--- File: $f ---"
    cat "$f"
  fi
done

echo "=== 8. FRONTEND PUBLIC_HTML ==="
ls -la /home/u403881955/domains/betappl.kcnanja.com/public_html

echo "=== 9. FRONTEND INDEX.HTML ==="
cat /home/u403881955/domains/betappl.kcnanja.com/public_html/index.html

echo "=== 10. DB INSPECTION ==="
if [ -f "$D/.env" ]; then
  DB_PASS=$(grep '^DB_PASSWORD=' "$D/.env" | cut -d '=' -f2- | sed -e 's/^[ \t"'\''\r]*//' -e 's/[ \t"'\''\r]*$//')
  DB_USER=$(grep '^DB_USER=' "$D/.env" | cut -d '=' -f2- | sed -e 's/^[ \t"'\''\r]*//' -e 's/[ \t"'\''\r]*$//')
  DB_NAME=$(grep '^DB_NAME=' "$D/.env" | cut -d '=' -f2- | sed -e 's/^[ \t"'\''\r]*//' -e 's/[ \t"'\''\r]*$//')
  mysql -h 127.0.0.1 -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "SHOW TABLES; SELECT * FROM app_settings LIMIT 5;" 2>/dev/null || true
fi

echo "=== INSPECT DONE ==="
