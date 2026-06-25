#!/bin/bash

# Exit on error
set -e

echo "======================================"
echo "  Starting CEO Command Center Setup  "
echo "======================================"

# 1. System Updates & Dependencies
echo "[1/6] Installing System Dependencies..."
sudo apt-get update -y
sudo apt-get install -y curl unzip nginx python3 python3-venv python3-pip xvfb

# Install Google Chrome for Selenium (if not already installed)
if ! command -v google-chrome &> /dev/null; then
    echo "Installing Google Chrome..."
    wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
    sudo apt install -y ./google-chrome-stable_current_amd64.deb
    rm google-chrome-stable_current_amd64.deb
else
    echo "Google Chrome is already installed. Skipping."
fi

# 2. Install Node.js & PM2
echo "[2/6] Installing Node.js & PM2..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# 3. Setup Project Directory
echo "[3/6] Setting up project directory..."
sudo mkdir -p /var/www/ceo
sudo chown -R ubuntu:ubuntu /var/www/ceo
cd /var/www/ceo

# Move uploaded tar to the right place and untar
# Look in both home directories since sudo might change ~
if [ -f "/home/ubuntu/deploy.tar.gz" ]; then
    mv /home/ubuntu/deploy.tar.gz /var/www/ceo/
elif [ -f "~/deploy.tar.gz" ]; then
    mv ~/deploy.tar.gz /var/www/ceo/
fi

cd /var/www/ceo
tar -xzf deploy.tar.gz
rm -f deploy.tar.gz

# 4. Setup Python Backend
echo "[4/6] Setting up Python Backend..."
cd /var/www/ceo/backend
python3 -m venv --system-site-packages venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd /var/www/ceo

# 5. Setup WhatsApp Service
echo "[5/6] Setting up WhatsApp Service..."
cd /var/www/ceo/whatsapp-service
npm install || true
cd /var/www/ceo

# 6. PM2 Configuration
echo "[6/6] Configuring PM2 Processes..."
pm2 stop all || true
pm2 delete all || true

# Start Python API (uvicorn)
cd /var/www/ceo/backend
# Ensure port 8000 is free
sudo fuser -k 8000/tcp || true
pm2 start "venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000" --name "ceo-backend"

pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root || true

# 7. Nginx Configuration
echo "Configuring Nginx Reverse Proxy..."
PUBLIC_IP=$(curl -s ifconfig.me)

sudo tee /etc/nginx/sites-available/ceo > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name ceo.varaahigroups.com _;

    root /var/www/ceo/dist;
    index index.html;

    # Support large attachments (up to 25 MB)
    client_max_body_size 25M;

    # Frontend SPA — serve index.html for all unmatched routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Python FastAPI backend — keep /api prefix intact
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 120s;
    }

    # WhatsApp Node.js service — strip /wa prefix when forwarding to port 3001
    location /wa/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

}
NGINXEOF

sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/ceo /etc/nginx/sites-enabled/ceo
sudo nginx -t && sudo systemctl restart nginx

# 8. Setup SSL via Certbot
echo "Setting up SSL with Certbot..."
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ceo.varaahigroups.com --non-interactive --agree-tos --email admin@varaahigroups.com

echo "======================================"
echo "  Setup Complete!"
echo "  App: https://$PUBLIC_IP"
echo "  Domain: https://ceo.varaahigroups.com"
echo "======================================"
