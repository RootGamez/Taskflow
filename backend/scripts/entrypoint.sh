#!/bin/sh
set -e

if [ "$DB_ENGINE" = "postgres" ]; then
  echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
  python - <<'PY'
import os
import time
import psycopg2

host = os.getenv("DB_HOST", "postgres")
port = int(os.getenv("DB_PORT", "5432"))
name = os.getenv("DB_NAME", "taskflow")
user = os.getenv("DB_USER", "taskflow")
password = os.getenv("DB_PASSWORD", "taskflow")

for _ in range(30):
    try:
        conn = psycopg2.connect(host=host, port=port, dbname=name, user=user, password=password)
        conn.close()
        print("PostgreSQL is ready")
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("PostgreSQL is not reachable")
PY
fi

python manage.py migrate --noinput

exec "$@"
