#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/root/skill-gomoku-online}"
PORT="${PORT:-8080}"
PM2_NAME="${PM2_NAME:-gomoku-ws}"

cd "$APP_DIR"

git fetch --all --prune
git pull --ff-only

npm install
npm --prefix server install
npm --prefix server run build

PORT="$PORT" pm2 restart "$PM2_NAME" --update-env
pm2 save

echo "Updated and restarted:"
pm2 status "$PM2_NAME"
echo "Health check:"
curl -fsS "http://127.0.0.1:${PORT}/health" && echo
