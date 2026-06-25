$IP = "52.66.112.231"
$USER = "ubuntu"
$KEY = "C:\Users\Admin\Documents\marketer splite\CEO.pem"

$script = @"
sudo tee /etc/nginx/sites-available/ceo > /dev/null << 'NGINXEOF'
server {
    listen 80;
    server_name ceo.varaahigroups.com _;

    root /var/www/ceo/dist;
    index index.html;

    client_max_body_size 25M;

    location / {
        try_files `$uri `$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
        proxy_send_timeout 120s;
    }

    location /wa/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade `$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_read_timeout 120s;
    }
}
NGINXEOF

sudo ln -sf /etc/nginx/sites-available/ceo /etc/nginx/sites-enabled/ceo
sudo systemctl restart nginx
sudo certbot --nginx -d ceo.varaahigroups.com --non-interactive --agree-tos --email admin@varaahigroups.com
"@

Set-Content -Path "C:\Users\Admin\Documents\CEO\remote_change.sh" -Value $script
scp -i "$KEY" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes "C:\Users\Admin\Documents\CEO\remote_change.sh" "${USER}@${IP}:/home/ubuntu/remote_change.sh"
ssh -i "$KEY" -o StrictHostKeyChecking=no -o IdentitiesOnly=yes "${USER}@${IP}" "bash /home/ubuntu/remote_change.sh"
