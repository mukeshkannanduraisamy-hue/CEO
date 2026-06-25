# push_ui_only.ps1
# Builds and deploys the React frontend to EC2, then fixes Nginx permissions.

$IP  = "52.66.112.231"
$KEY = "C:\Users\Admin\Documents\marketer splite\CEO.pem"
$SSH = "ssh -i `"$KEY`" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes ubuntu@$IP"
$SCP = "scp -i `"$KEY`" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes"

Write-Host "--- [1/3] Building frontend ---" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "Build failed!" -ForegroundColor Red; exit 1 }

Write-Host "--- [2/3] Uploading dist to EC2 ---" -ForegroundColor Cyan
Invoke-Expression "$SCP -r dist ubuntu@${IP}:/home/ubuntu/"
Invoke-Expression "$SSH `"sudo rm -rf /var/www/ceo/dist && sudo mv /home/ubuntu/dist /var/www/ceo/`""

Write-Host "--- [3/3] Fixing Nginx permissions ---" -ForegroundColor Cyan
Invoke-Expression "$SSH `"sudo chmod -R 755 /var/www/ceo/dist && sudo chown -R www-data:www-data /var/www/ceo/dist`""

Write-Host "--- Done! Visit: https://ceo.varaahigroups.com ---" -ForegroundColor Green
