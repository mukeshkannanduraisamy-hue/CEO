# start_local.ps1
Write-Host "--- Starting CEO Command Center Locally ---" -ForegroundColor Cyan

# 1. Start Backend
Write-Host "[1/3] Starting Python Backend on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; if (-not (Test-Path venv)) { python -m venv venv }; .\venv\Scripts\activate; pip install -r requirements.txt; uvicorn main:app --reload --host 0.0.0.0 --port 8000"

# 2. Start WhatsApp Service
Write-Host "[2/3] Starting WhatsApp Service on port 3001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd whatsapp-service; npm install; npm start"

# 3. Start Frontend
Write-Host "[3/3] Starting Frontend on port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm install; npm run dev"

Write-Host "All services started in separate windows!" -ForegroundColor Green
