#!/bin/bash
F=/home/u403881955/domains/betappl.kcnanja.com/public_html

echo "=== LOCALSTORAGE KEYS IN FRONTEND ==="
grep -roh "localStorage\.getItem([^)]*)" "$F"/*.js | sort -u | head -n 30 || true
grep -roh "localStorage\.setItem([^,]*" "$F"/*.js | sort -u | head -n 30 || true
