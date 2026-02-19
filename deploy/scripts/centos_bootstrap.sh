#!/usr/bin/env bash
set -euo pipefail

if command -v dnf >/dev/null 2>&1; then
  PKG=dnf
else
  PKG=yum
fi

sudo "$PKG" -y update
sudo "$PKG" -y install git curl nginx firewalld

curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo "$PKG" -y install nodejs

sudo systemctl enable firewalld
sudo systemctl start firewalld
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

sudo npm i -g pm2

echo "node: $(node -v)"
echo "npm: $(npm -v)"
echo "pm2: $(pm2 -v)"
