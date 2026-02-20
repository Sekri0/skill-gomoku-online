#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

npm install
npm --prefix server install

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

npm --prefix server run dev &
SERVER_PID=$!

echo "Local server started (pid=$SERVER_PID), ws://127.0.0.1:8080/ws"
echo "Starting web client on http://127.0.0.1:5173 ..."
npm run dev
