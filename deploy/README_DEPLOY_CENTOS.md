# Tencent Cloud CentOS Deployment (WebSocket + Nginx + PM2)

This guide deploys the existing server in this repo to CentOS/OpenCloudOS.

## 1) Prerequisites

- A domain pointing to your server public IP (A record).
- Ports opened in cloud security group: `22`, `80`, `443`.
- SSH access as a privileged user.

## 2) Bootstrap server dependencies

Run on the server:

```bash
sudo bash deploy/scripts/centos_bootstrap.sh
```

This installs:
- git, curl, nginx, firewalld
- Node.js 20
- pm2

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

If `pm2 startup` prints an extra command, run that command once, then run `pm2 save` again.

## 5) Configure Nginx reverse proxy

Copy template and replace domain:

```bash
sudo cp deploy/nginx/gomoku.conf /etc/nginx/conf.d/gomoku.conf
sudo sed -i 's/__DOMAIN__/your-domain.com/g' /etc/nginx/conf.d/gomoku.conf
```

Validate and reload:

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx
```

Health checks:

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1/health
```

## 6) Enable HTTPS (required for Android production)

Install certbot (if not already installed), then:

```bash
sudo certbot --nginx -d your-domain.com
```

After success:
- WebSocket endpoint: `wss://your-domain.com/ws`
- Health endpoint: `https://your-domain.com/health`

## 7) Frontend runtime endpoint

Set frontend ws url to:

```bash
VITE_WS_URL=wss://your-domain.com/ws
```

Then rebuild frontend and (if needed) copy to Capacitor.

## 8) Update deployment later

```bash
cd /opt/skill-gomoku-online
bash deploy/scripts/deploy_update.sh
```

## 9) Troubleshooting

Check port bindings:

```bash
ss -lntp | grep -E ':80|:443|:8080'
```

Check PM2:

```bash
pm2 ls
pm2 logs gomoku-ws --lines 200
```

Check Nginx:

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager -l
sudo journalctl -u nginx -n 200 --no-pager
```
