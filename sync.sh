#!/bin/bash
set -e
D=/home/u403881955/domains

source $D/pplapi.kcnanja.com/hbuilds/config/.env
SRC_USER=$DB_USER
SRC_PASS=$DB_PASSWORD
SRC_DB=$DB_NAME

source $D/betapplapi.kcnanja.com/hbuilds/config/.env
DST_USER=$DB_USER
DST_PASS=$DB_PASSWORD
DST_DB=$DB_NAME

echo "=== 1. DUMPING FROM $SRC_DB ==="
mysqldump -h 127.0.0.1 -u "$SRC_USER" -p"$SRC_PASS" --single-transaction --quick --routines --triggers "$SRC_DB" > /tmp/ppl_sync_dump.sql

echo "=== 2. IMPORTING INTO $DST_DB ==="
mysql -h 127.0.0.1 -u "$DST_USER" -p"$DST_PASS" "$DST_DB" < /tmp/ppl_sync_dump.sql
rm -f /tmp/ppl_sync_dump.sql

echo "=== 3. SYNCING UPLOADS ==="
if [ -d "$D/pplapi.kcnanja.com/storage/uploads" ]; then
    mkdir -p "$D/betapplapi.kcnanja.com/storage/uploads"
    cp -rn $D/pplapi.kcnanja.com/storage/uploads/* "$D/betapplapi.kcnanja.com/storage/uploads/" 2>/dev/null || true
fi

echo "=== SYNC COMPLETED SUCCESSFULLY ==="
