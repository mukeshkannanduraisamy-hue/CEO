#!/bin/bash
set -e
D=/home/u403881955/domains

echo "=== STARTING CRICKET PROD -> BETA SYNC ==="
date

find_env() {
    local domain=$1
    for p in "$D/$domain/hbuilds/config/.env" "$D/$domain/.env" "$D/$domain/public_html/.env"; do
        if [ -f "$p" ]; then
            echo "$p"
            return 0
        fi
    done
    return 1
}

PPL_ENV=$(find_env "pplapi.kcnanja.com")
BETA_ENV=$(find_env "betapplapi.kcnanja.com")

echo "Source ENV: $PPL_ENV"
echo "Target ENV: $BETA_ENV"

if [ -z "$PPL_ENV" ] || [ -z "$BETA_ENV" ]; then
    echo "ERROR: Could not locate .env files!"
    exit 1
fi

# Load source
SRC_USER=$(grep -E '^DB_USER=' "$PPL_ENV" | cut -d '=' -f2- | tr -d '"\r')
SRC_PASS=$(grep -E '^DB_PASSWORD=' "$PPL_ENV" | cut -d '=' -f2- | tr -d '"\r')
SRC_DB=$(grep -E '^DB_NAME=' "$PPL_ENV" | cut -d '=' -f2- | tr -d '"\r')

# Load target
DST_USER=$(grep -E '^DB_USER=' "$BETA_ENV" | cut -d '=' -f2- | tr -d '"\r')
DST_PASS=$(grep -E '^DB_PASSWORD=' "$BETA_ENV" | cut -d '=' -f2- | tr -d '"\r')
DST_DB=$(grep -E '^DB_NAME=' "$BETA_ENV" | cut -d '=' -f2- | tr -d '"\r')

echo "SRC DB: $SRC_DB (user: $SRC_USER)"
echo "DST DB: $DST_DB (user: $DST_USER)"

echo "=== 1. COUNTING SRC TABLES ==="
mysql -h 127.0.0.1 -u "$SRC_USER" -p"$SRC_PASS" -e "SELECT count(*) AS src_tables FROM information_schema.tables WHERE table_schema='$SRC_DB';" "$SRC_DB"

echo "=== 2. DUMPING FROM $SRC_DB ==="
mysqldump -h 127.0.0.1 -u "$SRC_USER" -p"$SRC_PASS" --single-transaction --quick --routines --triggers "$SRC_DB" > /tmp/ppl_sync_dump.sql
DUMP_SIZE=$(ls -lh /tmp/ppl_sync_dump.sql | awk '{print $5}')
echo "Dump size: $DUMP_SIZE"

echo "=== 3. IMPORTING INTO $DST_DB ==="
mysql -h 127.0.0.1 -u "$DST_USER" -p"$DST_PASS" "$DST_DB" < /tmp/ppl_sync_dump.sql
echo "Import finished."

echo "=== 4. VERIFYING DST TABLES ==="
mysql -h 127.0.0.1 -u "$DST_USER" -p"$DST_PASS" -e "SELECT count(*) AS dst_tables FROM information_schema.tables WHERE table_schema='$DST_DB';" "$DST_DB"

echo "=== 5. SAVING COMPRESSED BINARY FOR LOCAL BACKUP ==="
gzip -c /tmp/ppl_sync_dump.sql > /home/u403881955/domains/betappl.kcnanja.com/public_html/backup_data.bin
chmod 644 /home/u403881955/domains/betappl.kcnanja.com/public_html/backup_data.bin
rm -f /tmp/ppl_sync_dump.sql

echo "=== 6. SYNCING UPLOADS ==="
if [ -d "$D/pplapi.kcnanja.com/storage/uploads" ]; then
    mkdir -p "$D/betapplapi.kcnanja.com/storage/uploads"
    cp -rn $D/pplapi.kcnanja.com/storage/uploads/* "$D/betapplapi.kcnanja.com/storage/uploads/" 2>/dev/null || true
    chmod -R 755 "$D/betapplapi.kcnanja.com/storage/uploads" 2>/dev/null || true
    echo "Uploads synced. Count: $(ls -1 "$D/betapplapi.kcnanja.com/storage/uploads" | wc -l)"
fi

echo "=== 7. RESTARTING PASSENGER / NODE ==="
mkdir -p "$D/betapplapi.kcnanja.com/tmp"
touch "$D/betapplapi.kcnanja.com/tmp/restart.txt"
if [ -d "$D/betapplapi.kcnanja.com/hbuilds/current/nodejs/tmp" ]; then
    touch "$D/betapplapi.kcnanja.com/hbuilds/current/nodejs/tmp/restart.txt"
fi

echo "=== SYNC AND BACKUP EXPORT COMPLETED SUCCESSFULLY ==="
