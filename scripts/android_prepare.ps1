$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

npm install

if (-not (Test-Path "android")) {
  npx cap add android
}

npm run android:prepare

Write-Host "Android project prepared. Next: npm run cap:open"
