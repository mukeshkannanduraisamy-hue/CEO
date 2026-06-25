#!/bin/bash
# install_chrome_ubuntu.sh
# Installs Google Chrome + virtual display for headless WhatsApp Selenium on Ubuntu

set -e
echo "=== Installing Google Chrome for WhatsApp Selenium ==="

# 1. Install dependencies
sudo apt-get update -y
sudo apt-get install -y wget curl unzip gnupg2 ca-certificates apt-transport-https

# 2. Install Google Chrome stable
wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt-get install -y ./google-chrome-stable_current_amd64.deb
rm google-chrome-stable_current_amd64.deb

# 3. Install virtual display (Xvfb) — needed for headless GUI on server
sudo apt-get install -y xvfb x11-utils

# 4. Install pyvirtualdisplay python package into the venv
/var/www/ceo/backend/venv/bin/pip install pyvirtualdisplay

# 5. Verify Chrome installed correctly
google-chrome --version
echo "Chrome installed OK"

# 6. Install chromedriver via webdriver-manager (auto-selects matching version)
/var/www/ceo/backend/venv/bin/python -c "
from webdriver_manager.chrome import ChromeDriverManager
path = ChromeDriverManager().install()
print('ChromeDriver installed at:', path)
"

echo "=== Chrome Setup Complete ==="
