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

In Lobby choose online mode and use:

- Server URL: `ws://127.0.0.1:8080/ws`
- Same room id on both clients
- Different player names

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

## Capacitor commands

```bash
npm run cap:init
npm run cap:add-android
npm run cap:copy
npm run cap:open
```
