#!/bin/bash
set -e

echo "=== [1/6] Updating apt ==="
sudo apt-get update -qq

echo "=== [2/6] Installing Docker ==="
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker ubuntu
fi

echo "=== [3/6] Installing Docker Compose plugin ==="
sudo apt-get install -y -qq docker-compose-plugin || true

echo "=== [4/6] Cloning rentarvo repo ==="
cd /home/ubuntu
if [ ! -d rentarvo ]; then
  git clone https://github.com/edquad/rentarvo.git
fi
cd rentarvo
git pull origin main

echo "=== [5/6] Creating .env.prod ==="
if [ ! -f .env.prod ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  cat > .env.prod <<EOF
NODE_ENV=production
DB_NAME=rentarvo
DB_USER=rentarvo
DB_PASSWORD=Rentarvo2026!
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
PGADMIN_EMAIL=admin@rentarvo.com
PGADMIN_PASSWORD=Rentarvo2026!
EOF
  echo ".env.prod created"
fi

echo "=== [6/6] Starting Docker Compose ==="
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod pull || true
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo ""
echo "=== Status ==="
sudo docker ps --format 'table {{.Names}}\t{{.Status}}'
