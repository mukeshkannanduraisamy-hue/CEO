$exclude = @("*\.wa_session*", "*__pycache__*", "*node_modules*", "*venv*")
$files = Get-ChildItem -Path dist, backend, whatsapp-service, package.json -Recurse -Exclude $exclude | 
  Where-Object { -not $_.FullName.Contains('.wa_session') -and -not $_.FullName.Contains('__pycache__') -and -not $_.FullName.Contains('node_modules') -and -not $_.FullName.Contains('venv') } | 
  Select-Object -ExpandProperty FullName | Select-Object -Unique

Compress-Archive -Path $files -DestinationPath deploy.zip -Force
