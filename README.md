# Skill Gomoku

15x15 技能五子棋（Vite + TypeScript + Canvas + Capacitor）。

默认联机地址：`ws://1.13.164.21:8080/ws`

## 1. 环境要求

- Node.js 18+（建议 20）
- npm
- Android Studio（Android 调试/打包）

## 2. 本地启动

### PowerShell（Windows）

```powershell
.\scripts\dev_client.ps1
.\scripts\dev_server_local.ps1
```

或一键联调：

```powershell
.\scripts\dev_local_fullstack.ps1
```

### Bash（Linux/macOS/Git Bash）

```bash
bash scripts/dev_client.sh
bash scripts/dev_server_local.sh
```

或一键联调：

```bash
bash scripts/dev_local_fullstack.sh
```

## 3. 联机两种方式

### A. 本地 Client + 腾讯云 Server

腾讯云首次启动：

```bash
cd /root/skill-gomoku-online
bash deploy/scripts/tencent_server_start_8080.sh
```

腾讯云更新部署：

```bash
cd /root/skill-gomoku-online
bash deploy/scripts/tencent_server_update_8080.sh
```

前端联机地址填写：

`ws://1.13.164.21:8080/ws`

### B. 本地 Client + 本地 Server

联机地址填写：

`ws://127.0.0.1:8080/ws`

## 4. Android

准备 Android 工程：

```powershell
.\scripts\android_prepare.ps1
```

或：

```bash
bash scripts/android_prepare.sh
```

打开 Android Studio：

```bash
npm run cap:open
```

当前使用 `ws://`，需确保：

- `AndroidManifest.xml` 有 `INTERNET` 权限
- `application` 上开启 `android:usesCleartextTraffic="true"`
- `capacitor.config.ts` 已设置：
  - `server.androidScheme = "http"`
  - `server.cleartext = true`

## 5. 账号与房间

- 账号持久化：`server/data/accounts.json`（运行时文件，不纳入 Git）
- 模板文件：`server/data/accounts.example.json`
- 房间不持久化：房间玩家全部退出后自动销毁
- 可用环境变量覆盖账号文件：`ACCOUNTS_FILE=/path/to/accounts.json`

## 6. 一键拉取部署（避免 git pull 冲突）

已做的约定：

- `server/data/accounts.json` 已加入 `.gitignore`
- `*.tsbuildinfo` 已加入 `.gitignore`
- 部署脚本改为 `npm ci`，不会改写 lock 文件

因此服务端可直接：

```bash
cd /root/skill-gomoku-online
git pull --ff-only
bash deploy/scripts/tencent_server_update_8080.sh
```
