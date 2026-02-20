# Skill Gomoku

前端：Vite + TypeScript + Canvas  
服务端：Node.js + WebSocket  
联机默认技术路线：`8080 + ws://`

## 1) 环境要求

- Node.js 18+（建议 20）
- npm
- Bash 环境（Linux/macOS 或 Windows 的 Git Bash / WSL）

## 2) 脚本总览

本仓库已提供可直接执行的 Bash 脚本：

- 本地 client：`scripts/dev_client.sh`
- 本地 server：`scripts/dev_server_local.sh`
- 本地 client+server 一键联调：`scripts/dev_local_fullstack.sh`
- 腾讯云首次启动 server（PM2, 8080）：`deploy/scripts/tencent_server_start_8080.sh`
- 腾讯云更新并重启 server（PM2, 8080）：`deploy/scripts/tencent_server_update_8080.sh`

首次使用先加执行权限：

```bash
chmod +x scripts/*.sh deploy/scripts/*.sh
```

## 3) 方案A：本地部署 client + 腾讯云部署 server

### A-1 腾讯云服务器启动（CentOS / OpenCloudOS）

```bash
cd /root/skill-gomoku-online
bash deploy/scripts/tencent_server_start_8080.sh
```

健康检查：

```bash
curl http://127.0.0.1:8080/health
```

返回 `ok` 即正常。

### A-2 本地启动前端

```bash
cd /path/to/skill-gomoku-online
bash scripts/dev_client.sh
```

浏览器打开 `http://127.0.0.1:5173`（或终端显示地址）。

### A-3 游戏内填写联机地址

- 模式：`联机对战`
- 服务器地址：`ws://<你的腾讯云公网IP>:8080/ws`

例如：

- `ws://1.13.164.21:8080/ws`

### A-4 验证流程

- 两个浏览器标签页分别注册/登录不同账号
- A 创建房间并选择黑白
- B 加入同一房间
- 结束后房主点击“再来一局”（可选交换黑白）

## 4) 方案B：本地部署 client + 本地 localhost 充当 server

一键联调：

```bash
cd /path/to/skill-gomoku-online
bash scripts/dev_local_fullstack.sh
```

或分开启动：

```bash
bash scripts/dev_server_local.sh
bash scripts/dev_client.sh
```

游戏内联机地址填：

- `ws://127.0.0.1:8080/ws`

## 5) 账号与房间规则（当前实现）

- 账号持久化：`server/data/accounts.json`
- 房间不持久化：房间内用户全部退出后自动消失
- 可通过环境变量覆盖账号文件路径：`ACCOUNTS_FILE=/path/to/accounts.json`

## 6) 构建

```bash
npm run build
npm --prefix server run build
```

## 7) Android (Capacitor)

```bash
npm run cap:init
npm run cap:add-android
npm run cap:copy
npm run cap:open
```
