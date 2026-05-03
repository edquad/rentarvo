#!/bin/bash
# =============================================================================
# Rentarvo — EC2 Free-Tier Setup Script
# Run this after SSHing into a fresh Amazon Linux 2023 / Ubuntu EC2 instance.
# Usage: chmod +x ec2-setup.sh && ./ec2-setup.sh
# =============================================================================

set -euo pipefail

REPO_URL="${1:-}"
if [ -z "$REPO_URL" ]; then
  echo "Usage: ./ec2-setup.sh <github-repo-url>"
  echo "Example: ./ec2-setup.sh https://github.com/youruser/rentarvo.git"
  exit 1
fi

echo "=== Installing Docker ==="
sudo yum update -y 2>/dev/null || sudo apt-get update -y
sudo yum install -y docker git 2>/dev/null || sudo apt-get install -y docker.io docker-compose-plugin git

sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

echo "=== Installing Docker Compose ==="
DOCKER_COMPOSE_VERSION="v2.29.0"
sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo "=== Cloning Repository ==="
cd /home/ec2-user 2>/dev/null || cd /home/ubuntu
git clone "$REPO_URL" rentarvo
cd rentarvo

echo "=== Creating Production .env ==="
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

echo "=== Building & Starting Services ==="
sudo docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo ""
echo "=== Waiting for services to start ==="
sleep 15

echo "=== Seeding Database ==="
sudo docker exec rentarvo-api sh -c "npx tsx prisma/seed.ts" 2>/dev/null || echo "Seed skipped (may already exist)"

echo ""
echo "============================================"
echo "  Rentarvo is running!"
echo "============================================"
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "YOUR_EC2_IP")
echo "  URL:   http://${PUBLIC_IP}"
echo "  Login: owner@rentarvo.local / Rentarvo!2026"
echo "============================================"
