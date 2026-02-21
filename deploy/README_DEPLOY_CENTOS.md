# 腾讯云 CentOS 部署指南（公网 IP + 8080 + ws）

本指南使用最简路线：不依赖域名，不依赖 Nginx，客户端直连：

- `ws://<PUBLIC_IP>:8080/ws`
- 健康检查：`http://<PUBLIC_IP>:8080/health`

## 1. 前置条件

- 系统：CentOS / OpenCloudOS
- 安全组已放行：`22`、`8080`
- 已能通过 SSH 登录

## 2. 安装依赖（服务器执行）

```bash
cd /path/to/your/repo
sudo bash deploy/scripts/centos_bootstrap.sh
```

## 3. 拉取项目

```bash
mkdir -p /root/skill-gomoku-online
cd /root/skill-gomoku-online
git clone <YOUR_REPO_URL> .
```

## 4. 首次启动服务（PM2）

```bash
cd /root/skill-gomoku-online
bash deploy/scripts/tencent_server_start_8080.sh
```

检查状态：

```bash
pm2 status gomoku-ws
curl http://127.0.0.1:8080/health
```

预期返回：`ok`

## 5. 客户端连接配置

在游戏联机界面填写：

- `ws://<PUBLIC_IP>:8080/ws`

例如：

- `ws://1.13.164.21:8080/ws`

## 6. 后续更新部署

```bash
cd /root/skill-gomoku-online
git pull --ff-only
bash deploy/scripts/tencent_server_update_8080.sh
```

## 7. 账号文件与 Git 冲突处理

账号数据保存在：

- `server/data/accounts.json`

该文件已在 `.gitignore`，不会再阻塞 `git pull`。

如果你的旧服务器之前跟踪过该文件，先执行一次：

```bash
cd /root/skill-gomoku-online
git rm --cached server/data/accounts.json
git restore server/data/accounts.json
```

## 8. 故障排查

查看进程和日志：

```bash
pm2 ls
pm2 logs gomoku-ws --lines 200
```

查看端口监听：

```bash
ss -lntp | grep -E ':8080'
```

公网可达性：

```bash
curl http://127.0.0.1:8080/health
curl http://<PUBLIC_IP>:8080/health
```

如果公网不通，优先检查腾讯云安全组和系统防火墙。
