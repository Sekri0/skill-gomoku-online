# Skill Gomoku

15x15 技能五子棋（Vite + TypeScript + Canvas + Capacitor）。

默认联机地址：`ws://1.13.164.21:8080/ws`

## 环境要求

- Node.js 18+（建议 20）
- npm
- Android Studio（安卓调试/打包）

## 本地运行

### Windows PowerShell

启动前端：

```powershell
.\scripts\dev_client.ps1
```

启动本地服务端：

```powershell
.\scripts\dev_server_local.ps1
```

一键联调（前后端）：

```powershell
.\scripts\dev_local_fullstack.ps1
```

### Bash（Linux/macOS/Git Bash）

```bash
bash scripts/dev_client.sh
bash scripts/dev_server_local.sh
```

一键联调：

```bash
bash scripts/dev_local_fullstack.sh
```

## 联机方式

### 方式 A：本地 Client + 腾讯云 Server

腾讯云首次部署启动：

```bash
cd /root/skill-gomoku-online
bash deploy/scripts/tencent_server_start_8080.sh
```

腾讯云后续更新：

```bash
cd /root/skill-gomoku-online
bash deploy/scripts/tencent_server_update_8080.sh
```

前端填写地址：

`ws://1.13.164.21:8080/ws`

### 方式 B：本地 Client + 本地 Server

前端填写地址：

`ws://127.0.0.1:8080/ws`

## Android

准备 Android 工程：

```powershell
.\scripts\android_prepare.ps1
```

或

```bash
bash scripts/android_prepare.sh
```

打开 Android Studio：

```bash
npm run cap:open
```

当前是 `ws://` 联机，需确保：

- `AndroidManifest.xml` 有 `INTERNET` 权限
- `application` 有 `android:usesCleartextTraffic="true"`
- `capacitor.config.ts` 已设置：
  - `server.androidScheme = "http"`
  - `server.cleartext = true`

## 数据与持久化

- 账号文件：`server/data/accounts.json`（运行时文件，已忽略，不进 Git）
- 账号模板：`server/data/accounts.example.json`
- 房间不持久化：房间内玩家全部退出后自动销毁
- 可用环境变量覆盖账号文件路径：`ACCOUNTS_FILE=/path/to/accounts.json`

## 一键拉取部署（避免 git pull 冲突）

仓库已做以下约定：

- `server/data/accounts.json` 在 `.gitignore`
- `*.tsbuildinfo` 在 `.gitignore`
- 部署脚本使用 `npm ci`（不改 lock 文件）

服务端标准更新命令：

```bash
cd /root/skill-gomoku-online
git pull --ff-only
bash deploy/scripts/tencent_server_update_8080.sh
```

## 常用命令

```bash
npm run build
npm --prefix server run build
npm run android:doctor
npm run android:prepare
npm run android:sync # 修改前端代码后同步到安卓
```
