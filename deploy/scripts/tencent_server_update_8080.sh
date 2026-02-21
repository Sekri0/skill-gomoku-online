#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/root/skill-gomoku-online}"
PORT="${PORT:-8080}"
PM2_NAME="${PM2_NAME:-gomoku-ws}"

cd "$APP_DIR"

git fetch --all --prune
git pull --ff-only

npm ci
npm --prefix server ci
npm --prefix server run build

if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  PORT="$PORT" pm2 restart "$PM2_NAME" --update-env
else
  PORT="$PORT" pm2 start "npm --prefix server run start" --name "$PM2_NAME" --update-env
fi

pm2 save

echo "Updated and restarted:"
pm2 status "$PM2_NAME"
echo "Health check:"
curl -fsS "http://127.0.0.1:${PORT}/health" && echo
