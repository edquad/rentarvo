#!/bin/bash
set -e

cd /home/ubuntu/rentarvo

echo "=== [1/4] Creating .env.prod ==="
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

echo ""
echo "=== [2/4] Pulling Postgres + pgAdmin (cheap images) ==="
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod pull postgres pgadmin 2>&1 | tail -10

echo ""
echo "=== [3/4] Starting Postgres first (so DB is ready) ==="
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d postgres
sleep 5
sudo docker ps --format 'table {{.Names}}\t{{.Status}}'

echo ""
echo "=== [4/4] Building API + UI sequentially (memory-safe) ==="
echo ">>> Building API..."
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod build api 2>&1 | tail -20
echo ""
echo ">>> Building UI..."
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod build ui 2>&1 | tail -20
echo ""
echo ">>> Starting all services..."
sudo docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
sleep 5

echo ""
echo "=== STATUS ==="
sudo docker ps --format 'table {{.Names}}\t{{.Status}}'
echo ""
free -h
