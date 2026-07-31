#!/bin/bash
set -e
echo "=== TABLES ==="
sudo docker exec rentarvo-postgres psql -U rentarvo -d rentarvo -c "\dt"
echo ""
echo "=== ROW COUNTS ==="
sudo docker exec rentarvo-postgres psql -U rentarvo -d rentarvo -c "
SELECT relname AS table_name, n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
"
echo ""
echo "=== DB SIZE ==="
sudo docker exec rentarvo-postgres psql -U rentarvo -d rentarvo -c "
SELECT pg_size_pretty(pg_database_size('rentarvo')) AS db_size;
"
echo ""
echo "=== UPLOADS DIR ==="
sudo docker exec rentarvo-api ls -la /app/uploads/ 2>/dev/null | head -30 || echo "no uploads dir"
echo ""
echo "=== UPLOADS SIZE ==="
sudo docker exec rentarvo-api du -sh /app/uploads/ 2>/dev/null || echo "no uploads"
