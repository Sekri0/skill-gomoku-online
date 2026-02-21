#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

npm install

if [[ ! -d android ]]; then
  npx cap add android
fi

npm run android:prepare
echo "Android project prepared. Next: npm run cap:open"
