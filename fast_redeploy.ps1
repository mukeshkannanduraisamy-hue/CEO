# fast_redeploy.ps1
$IP = "15.207.192.102"
$USER = "ubuntu"
$KEY = "C:\Users\Admin\Documents\CRM-TELE\aws.pem"

Write-Host "--- Fast Redeploying UI Fixes ---" -ForegroundColor Cyan

# 1. Upload package
Write-Host "[1/2] Uploading package (optimized for slow connection)..."
scp -i $KEY -C -o StrictHostKeyChecking=no -o IdentitiesOnly=yes -o ConnectTimeout=60 -o "IPQoS=throughput" deploy.tar.gz "$($USER)@$($IP):~/deploy.tar.gz"

# 2. Extract and Refresh
Write-Host "[2/2] Extracting and Refreshing Services..."
ssh -i $KEY -C -o StrictHostKeyChecking=no -o IdentitiesOnly=yes "$($USER)@$($IP)" "
    sudo mkdir -p /var/www/ceo &&
    sudo chown -R ubuntu:ubuntu /var/www/ceo &&
    cd /var/www/ceo &&
    mv ~/deploy.tar.gz . &&
    tar -xzf deploy.tar.gz &&
    rm deploy.tar.gz &&
    pm2 restart all &&
    sudo systemctl restart nginx
"

Write-Host "--- Fast Redeploy Complete! ---" -ForegroundColor Green
