#!/bin/bash
# setup_https.sh
# Automates SSL certificate installation using Let's Encrypt / Certbot

set -e

DOMAIN="ceo.profitevertraders.com"

echo "--- Installing Certbot ---"
sudo apt-get update
sudo apt-get install -y certbot python3-certbot-nginx

echo "--- Requesting SSL Certificate for $DOMAIN ---"
# This will automatically update Nginx config and reload it
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect

echo "--- HTTPS Implementation Complete ---"
sudo systemctl restart nginx
