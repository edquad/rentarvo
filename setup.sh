#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=== Step 1: pnpm install ===" > /tmp/rentarvo-setup.log
pnpm install >> /tmp/rentarvo-setup.log 2>&1
echo "=== pnpm install DONE ===" >> /tmp/rentarvo-setup.log

echo "=== Step 2: Check bcryptjs ===" >> /tmp/rentarvo-setup.log
ls apps/api/node_modules/bcryptjs/ >> /tmp/rentarvo-setup.log 2>&1 || echo "bcryptjs NOT FOUND" >> /tmp/rentarvo-setup.log

echo "=== Step 3: Copy .env ===" >> /tmp/rentarvo-setup.log
cp .env.example .env >> /tmp/rentarvo-setup.log 2>&1
echo "=== .env copied ===" >> /tmp/rentarvo-setup.log

echo "=== SETUP COMPLETE ===" >> /tmp/rentarvo-setup.log
