#!/bin/bash
set -e

echo "=== Restoring DB from /tmp/rentarvo-backup.sql ==="
cat /tmp/rentarvo-backup.sql | sudo docker exec -i rentarvo-postgres psql -U rentarvo -d rentarvo > /tmp/restore.log 2>&1
echo "Restore done. Last 10 log lines:"
tail -10 /tmp/restore.log

echo ""
echo "=== Row counts (should match EC2) ==="
sudo docker exec rentarvo-postgres psql -U rentarvo -d rentarvo -c "
SELECT relname AS table_name, n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_live_tup DESC;
"

echo ""
echo "=== User count ==="
sudo docker exec rentarvo-postgres psql -U rentarvo -d rentarvo -c "SELECT count(*) FROM users;"
