#!/bin/bash
set -eux
exec > >(tee /var/log/rentarvo-bootstrap.log|logger -t rentarvo -s 2>/dev/console) 2>&1

dnf update -y
dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user

# Install docker compose plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/download/v2.29.0/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

cd /home/ec2-user
sudo -u ec2-user git clone https://github.com/edquad/rentarvo.git
cd rentarvo

JWT_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)

cat > .env.prod <<EOF
DB_USER=rentarvo
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=rentarvo
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*
NODE_ENV=production
EOF

chown ec2-user:ec2-user .env.prod

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

sleep 30

# Seed the database (idempotent — uses upserts)
docker exec rentarvo-api sh -c "npx tsx prisma/seed.ts" || true

echo "=== Rentarvo deployment complete ==="
