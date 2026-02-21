$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

npm install
npm run dev
