# Skill Gomoku (Vite + TypeScript + Canvas + Capacitor)

15x15 技能五子棋，支持本地热座和联机对战。  
前端使用 Vite + TypeScript + Canvas，联机服务端使用 Node.js + WebSocket，支持 Capacitor 打包 Android。

## 目录
- `src/` 前端代码
- `shared/` 前后端共享规则引擎（纯逻辑）
- `server/` 联机服务端（权威判定）

## 环境
- Node.js 18+
- npm
- Android Studio（Android 打包运行）

## 1) 安装前端依赖
```bash
npm install
```

## 2) 安装联机服务端依赖
```bash
npm --prefix server install
```

## 3) 本地运行（本地模式）
```bash
npm run dev
```

## 4) 本地运行（联机模式）
终端 A（启动服务端）：
```bash
npm run dev:server
```

终端 B（启动前端）：
```bash
npm run dev:web
```

在页面 Lobby 中选择“联机对战”，填写：
- 服务器地址：`ws://127.0.0.1:8080/ws`
- 房间号：例如 `room-1001`
- 昵称：自定义

两个客户端填同一房间号即可对战。

## 5) 前端构建
```bash
npm run build
```

## 6) Capacitor 初始化（一次）
```bash
npx cap init com.example.skillgomoku "Skill Gomoku" --web-dir=dist
```
或：
```bash
npm run cap:init
```

## 7) 添加 Android（一次）
```bash
npx cap add android
```
或：
```bash
npm run cap:add-android
```

## 8) 同步 Web 资源到 Android
```bash
npm run build
npx cap copy android
```
或：
```bash
npm run cap:copy
```

## 9) 打开 Android Studio
```bash
npx cap open android
```
或：
```bash
npm run cap:open
```

## 联机协议与规则说明
- 客户端只发送“动作意图”（落子/技能）。
- 服务端使用 `shared/engine.ts` 进行权威校验与状态推进。
- 服务端广播 `roomState`、`actionApplied`、`actionRejected`、`gameOver`。
- 断线重连保留席位 60 秒。

## 安卓联机注意事项
- 正式环境请使用 `wss://`。
- 若用局域网 `ws://` 调试，手机需和服务端处于同一网络。
- 每次前端改动后都要执行 `build + cap copy` 再运行 Android。

## Localhost 快速联调（推荐先跑通）
1. 安装依赖：
```bash
npm install
npm --prefix server install
```
2. 启动服务端（优先）：
```bash
npm run dev:server
```
3. 如果 `dev:server` 因 `tsx` 权限问题失败，使用编译后启动：
```bash
npm run dev:server:local
```
4. 启动前端：
```bash
npm run dev:web
```
5. 联机页面填写：
- 服务器地址：`ws://127.0.0.1:8080/ws`
- 房间号：两端相同
- 昵称：两端不同

## 腾讯云部署

完整 CentOS/OpenCloudOS 部署说明见：

`deploy/README_DEPLOY_CENTOS.md`
