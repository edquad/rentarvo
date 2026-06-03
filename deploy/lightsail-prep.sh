#!/bin/bash
set -e

echo "=== [1/3] Adding 2GB swap ==="
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
free -h

echo ""
echo "=== [2/3] Installing Docker ==="
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker ubuntu
fi
docker --version

echo ""
echo "=== [3/3] Cloning repo ==="
cd /home/ubuntu
if [ ! -d rentarvo ]; then
  git clone https://github.com/edquad/rentarvo.git
fi
cd rentarvo
git pull origin main 2>&1 | tail -3

echo ""
echo "=== Done. Now run lightsail-build.sh to build images. ==="
