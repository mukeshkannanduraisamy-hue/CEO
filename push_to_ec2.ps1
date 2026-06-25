# push_to_ec2.ps1
$IP = "52.66.112.231"
$USER = "ubuntu"
$KEY = "C:\Users\Admin\Documents\marketer splite\CEO.pem"

Write-Host "--- Starting Deployment to $IP (using aws.pem) ---" -ForegroundColor Cyan

# 0. Free up space
Write-Host "[1/3] Freeing up disk space on EC2..."
ssh -i $KEY -o StrictHostKeyChecking=no -o IdentitiesOnly=yes "$($USER)@$($IP)" "sudo apt-get clean && sudo rm -rf /var/www/ceo/whatsapp-service/node_modules && sudo rm -rf /root/.npm/_logs/*"

# 1. Upload files
Write-Host "[2/3] Uploading package and setup script..."
scp -i $KEY -o StrictHostKeyChecking=no -o IdentitiesOnly=yes deploy.tar.gz "$($USER)@$($IP):~/deploy.tar.gz"
scp -i $KEY -o StrictHostKeyChecking=no -o IdentitiesOnly=yes ec2-setup.sh "$($USER)@$($IP):~/ec2-setup.sh"

# 2. Run setup
Write-Host "[3/3] Running setup on EC2..."
ssh -i $KEY -o StrictHostKeyChecking=no -o IdentitiesOnly=yes "$($USER)@$($IP)" "chmod +x ~/ec2-setup.sh && sudo ~/ec2-setup.sh"

Write-Host "--- Deployment Finished! ---" -ForegroundColor Green
Write-Host "App URL: http://$IP"
Write-Host "Domain: https://ceo.varaahigroups.com"
