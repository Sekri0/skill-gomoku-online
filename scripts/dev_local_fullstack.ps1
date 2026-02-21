$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

npm install
npm --prefix server install

$serverProcess = Start-Process -FilePath "npm" -ArgumentList "--prefix","server","run","dev" -PassThru

try {
  Write-Host "Local server started, ws://127.0.0.1:8080/ws"
  Write-Host "Starting web client on http://127.0.0.1:5173 ..."
  npm run dev
}
finally {
  if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
