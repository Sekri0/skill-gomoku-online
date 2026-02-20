# Skill Gomoku (Vite + TypeScript + Canvas + Capacitor)

15x15 skill Gomoku game with:

- Local hot-seat mode
- Online mode (WebSocket)
- Android packaging via Capacitor

## Requirements

- Node.js 18+ (recommended 20)
- npm
- Android Studio (only for Android packaging)

## Install

```bash
npm install
npm --prefix server install
```

## Run locally

### Web client

```bash
npm run dev:web
```

### Game server

```bash
npm run dev:server
```

If `dev:server` fails due `tsx` permission on your environment, use:

```bash
npm run dev:server:local
```

## Localhost online test

1. Start server and web client.
2. Open two browser tabs.
3. In both tabs select `联机对战`, set server URL to `ws://127.0.0.1:8080/ws`.
4. Register/login with two different accounts.
5. In lobby:
   - Player A creates room and chooses black/white.
   - Player B joins that room.
6. After a game ends, host can click `再来一局` and choose whether to swap colors.

You can verify server health by:

```bash
curl http://127.0.0.1:8080/health
```

## Build

```bash
npm run build
npm --prefix server run build
```

## Tencent Cloud deployment (public IP route)

Use:

`deploy/README_DEPLOY_CENTOS.md`

This route targets:

- `ws://<PUBLIC_IP>/ws`

No domain is required for this route.

## Account persistence

- Account data is stored in JSON: `server/data/accounts.json`.
- Room data is not persisted; if all users leave a room, the room is removed automatically.
- You can override account file path with env var: `ACCOUNTS_FILE=/path/to/accounts.json`.

## Capacitor commands

```bash
npm run cap:init
npm run cap:add-android
npm run cap:copy
npm run cap:open
```
