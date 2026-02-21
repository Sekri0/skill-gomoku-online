$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

npm --prefix server install
npm --prefix server run dev
