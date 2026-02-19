#!/usr/bin/env bash
set -euo pipefail

cd /opt/skill-gomoku-online

git fetch --all --prune
git pull --ff-only

npm install
npm --prefix server install
npm --prefix server run build

pm2 restart gomoku-ws
pm2 save

echo "Deploy update completed."
