# package_deploy.ps1
# 1. Build the frontend
npm run build

# 2. Define files to include
$include = @(
    "dist",
    "backend",
    "whatsapp-service",
    "package.json",
    "ec2-setup.sh"
)

# 3. Create temporary deployment folder
$deployDir = "deploy_temp"
if (Test-Path $deployDir) { Remove-Item -Path $deployDir -Recurse -Force }
New-Item -ItemType Directory -Path $deployDir

# 4. Copy files (with exclusions)
foreach ($item in $include) {
    if (Test-Path $item) {
        if ($item -eq "whatsapp-service") {
            # Copy whatsapp-service but exclude .wa_session
            New-Item -ItemType Directory -Path "$deployDir/whatsapp-service"
            Get-ChildItem -Path "whatsapp-service" -Exclude ".wa_session", "node_modules" | Copy-Item -Destination "$deployDir/whatsapp-service" -Recurse -Force
        } elseif ($item -eq "backend") {
             # Copy backend but exclude venv, __pycache__
            New-Item -ItemType Directory -Path "$deployDir/backend"
            Get-ChildItem -Path "backend" -Exclude "venv", "__pycache__", "whatsapp_session", "chrome_data" | Copy-Item -Destination "$deployDir/backend" -Recurse -Force
        } else {
            Copy-Item -Path $item -Destination $deployDir -Recurse -Force
        }
    }
}

# 5. Double check and remove any stray files
Get-ChildItem -Path $deployDir -Recurse | Where-Object { 
    $_.FullName -like "*node_modules*" -or 
    $_.FullName -like "*venv*" -or 
    $_.FullName -like "*__pycache__*" -or 
    $_.FullName -like "*.wa_session*" -or
    $_.Name -eq ".git"
} | Remove-Item -Recurse -Force

# 6. Update backend/.env for production
$envPath = "$deployDir/backend/.env"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
    $newEnvContent = $envContent | ForEach-Object {
        if ($_ -match "^ZOHO_REDIRECT_URI=") {
            "ZOHO_REDIRECT_URI=https://ceo.varaahigroups.com/api/auth/zoho/callback"
        } elseif ($_ -match "^FRONTEND_URL=") {
            "FRONTEND_URL=https://ceo.varaahigroups.com"
        } else {
            $_
        }
    }
    $newEnvContent | Set-Content $envPath
}

# 7. Create tar.gz
Write-Host "Creating deploy.tar.gz..."
tar -czf deploy.tar.gz -C $deployDir .

# 8. Cleanup
# Remove-Item -Path $deployDir -Recurse -Force

Write-Host "Deployment package created: deploy.tar.gz"
