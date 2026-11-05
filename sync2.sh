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

clean_val() {
    local v="$1"
    echo "$v" | sed -e "s/^[ \t'\"]*//" -e "s/[ \t'\"]*$//" | tr -d '\r'
}

get_env_val() {
    local file="$1"
    local key="$2"
    local raw=$(grep -E "^${key}=" "$file" | head -n 1 | cut -d '=' -f2-)
    clean_val "$raw"
}

SRC_USER=$(get_env_val "$PPL_ENV" "DB_USER")
SRC_PASS=$(get_env_val "$PPL_ENV" "DB_PASSWORD")
SRC_DB=$(get_env_val "$PPL_ENV" "DB_NAME")
SRC_HOST=$(get_env_val "$PPL_ENV" "DB_HOST")
[ -z "$SRC_HOST" ] && SRC_HOST="127.0.0.1"

DST_USER=$(get_env_val "$BETA_ENV" "DB_USER")
DST_PASS=$(get_env_val "$BETA_ENV" "DB_PASSWORD")
DST_DB=$(get_env_val "$BETA_ENV" "DB_NAME")
DST_HOST=$(get_env_val "$BETA_ENV" "DB_HOST")
[ -z "$DST_HOST" ] && DST_HOST="127.0.0.1"

echo "SRC DB: $SRC_DB (user: $SRC_USER, host: $SRC_HOST)"
echo "DST DB: $DST_DB (user: $DST_USER, host: $DST_HOST)"

find_working_host() {
    local user="$1"
    local pass="$2"
    local db="$3"
    local preferred="$4"
    for h in "$preferred" "127.0.0.1" "localhost" "srv1497.hstgr.io"; do
        if mysql -h "$h" -u "$user" -p"$pass" -e "SELECT 1;" "$db" >/dev/null 2>&1; then
            echo "$h"
            return 0
        fi
    done
    return 1
}

echo "Resolving MySQL hosts..."
SRC_ACTUAL_HOST=$(find_working_host "$SRC_USER" "$SRC_PASS" "$SRC_DB" "$SRC_HOST") || {
    echo "ERROR: Failed to connect to source DB $SRC_DB on any host!"
    exit 1
}
echo "Source connected via: $SRC_ACTUAL_HOST"

DST_ACTUAL_HOST=$(find_working_host "$DST_USER" "$DST_PASS" "$DST_DB" "$DST_HOST") || {
    echo "ERROR: Failed to connect to target DB $DST_DB on any host!"
    exit 1
}
echo "Target connected via: $DST_ACTUAL_HOST"

echo "=== 1. COUNTING SRC TABLES ==="
mysql -h "$SRC_ACTUAL_HOST" -u "$SRC_USER" -p"$SRC_PASS" -e "SELECT count(*) AS src_tables FROM information_schema.tables WHERE table_schema='$SRC_DB';" "$SRC_DB"

echo "=== 2. DUMPING FROM $SRC_DB ==="
mysqldump -h "$SRC_ACTUAL_HOST" -u "$SRC_USER" -p"$SRC_PASS" --single-transaction --quick --routines --triggers "$SRC_DB" > /tmp/ppl_sync_dump.sql
DUMP_SIZE=$(ls -lh /tmp/ppl_sync_dump.sql | awk '{print $5}')
echo "Dump size: $DUMP_SIZE"

echo "=== 3. IMPORTING INTO $DST_DB ==="
mysql -h "$DST_ACTUAL_HOST" -u "$DST_USER" -p"$DST_PASS" "$DST_DB" < /tmp/ppl_sync_dump.sql
echo "Import finished."

echo "=== 4. VERIFYING DST TABLES ==="
mysql -h "$DST_ACTUAL_HOST" -u "$DST_USER" -p"$DST_PASS" -e "SELECT count(*) AS dst_tables FROM information_schema.tables WHERE table_schema='$DST_DB';" "$DST_DB"

echo "=== 5. SAVING COMPRESSED BINARY FOR LOCAL BACKUP ==="
gzip -c /tmp/ppl_sync_dump.sql > /home/u403881955/domains/betappl.kcnanja.com/public_html/backup_data.bin
chmod 644 /home/u403881955/domains/betappl.kcnanja.com/public_html/backup_data.bin
rm -f /tmp/ppl_sync_dump.sql

echo "=== 6. SYNCING UPLOADS ==="
if [ -d "$D/pplapi.kcnanja.com/storage/uploads" ]; then
    mkdir -p "$D/betapplapi.kcnanja.com/storage/uploads"
    cp -rn $D/pplapi.kcnanja.com/storage/uploads/* "$D/betapplapi.kcnanja.com/storage/uploads/" 2>/dev/null || true
    chmod -R 755 "$D/betapplapi.kcnanja.com/storage/uploads" 2>/dev/null || true
    echo "Uploads synced. Count: $(ls -1 "$D/betapplapi.kcnanja.com/storage/uploads" 2>/dev/null | wc -l)"
fi

echo "=== 7. RESTARTING PASSENGER / NODE ==="
mkdir -p "$D/betapplapi.kcnanja.com/tmp"
touch "$D/betapplapi.kcnanja.com/tmp/restart.txt"
if [ -d "$D/betapplapi.kcnanja.com/hbuilds/current/nodejs/tmp" ]; then
    touch "$D/betapplapi.kcnanja.com/hbuilds/current/nodejs/tmp/restart.txt"
fi

echo "=== SYNC AND BACKUP EXPORT COMPLETED SUCCESSFULLY ==="
