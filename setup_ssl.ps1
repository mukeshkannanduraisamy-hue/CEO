$IP = "52.66.112.231"
$USER = "ubuntu"
$KEY = "C:\Users\Admin\Documents\marketer splite\CEO.pem"

Write-Host "Installing Certbot and securing Nginx with Let's Encrypt..."
ssh -i $KEY -o StrictHostKeyChecking=no -o IdentitiesOnly=yes "$($USER)@$($IP)" "
    sudo apt-get update -y &&
    sudo apt-get install -y certbot python3-certbot-nginx &&
    sudo certbot --nginx -d ceo.varaahigroups.com --non-interactive --agree-tos --register-unsafely-without-email --redirect
"
Write-Host "SSL Setup Complete!"
