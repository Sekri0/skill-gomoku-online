# Tencent Cloud CentOS Deployment (Public IP Route, No Domain)

This guide deploys the current WebSocket server with **public IP + ws**.

Target endpoint for clients:

- `ws://<PUBLIC_IP>/ws`

Health checks:

- `http://<PUBLIC_IP>/health`

## 1) Prerequisites

- Tencent Cloud security group allows: `22`, `80`.
- SSH access to your server.
- CentOS/OpenCloudOS server.

## 2) Bootstrap dependencies

Run on server:

```bash
sudo bash deploy/scripts/centos_bootstrap.sh
```

## 3) Clone and install project

```bash
sudo mkdir -p /opt/skill-gomoku-online
sudo chown -R $USER:$USER /opt/skill-gomoku-online
cd /opt/skill-gomoku-online

# replace with your repo URL
git clone <YOUR_REPO_URL> .

npm install
npm --prefix server install
npm --prefix server run build
```

## 4) Start server with PM2

```bash
cd /opt/skill-gomoku-online
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
pm2 startup
```

If `pm2 startup` prints an extra command, run it once and then run:

```bash
pm2 save
```

## 5) Configure Nginx reverse proxy

Template already uses `server_name _;`, no domain replacement needed.

```bash
sudo cp deploy/nginx/gomoku.conf /etc/nginx/conf.d/gomoku.conf
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

## 6) Verify service

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1/health
curl http://<PUBLIC_IP>/health
```

Expected: `ok`

## 7) Client configuration

In game lobby:

- Server URL: `ws://<PUBLIC_IP>/ws`
- Same room id for both players
- Different player names

## 8) Update deployment later

```bash
cd /opt/skill-gomoku-online
bash deploy/scripts/deploy_update.sh
```

## 9) Troubleshooting

Check process and ports:

```bash
pm2 ls
pm2 logs gomoku-ws --lines 200
ss -lntp | grep -E ':80|:8080'
```

Check nginx:

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager -l
sudo journalctl -u nginx -n 200 --no-pager
```

---

Note: this route uses plain `ws` (no TLS). It is suitable for temporary small-group play, not production security.
