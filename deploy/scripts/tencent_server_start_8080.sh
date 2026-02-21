#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/root/skill-gomoku-online}"
PORT="${PORT:-8080}"
PM2_NAME="${PM2_NAME:-gomoku-ws}"

cd "$APP_DIR"

npm --prefix server ci
npm --prefix server run build

pm2 delete "$PM2_NAME" >/dev/null 2>&1 || true
PORT="$PORT" pm2 start "npm --prefix server run start" --name "$PM2_NAME" --update-env
pm2 save

echo "Server started by PM2:"
pm2 status "$PM2_NAME"
echo "Health check:"
curl -fsS "http://127.0.0.1:${PORT}/health" && echo
echo "WebSocket URL: ws://<PUBLIC_IP>:${PORT}/ws"
