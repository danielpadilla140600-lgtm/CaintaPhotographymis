#!/usr/bin/env bash
set -euo pipefail

SQL_FILE="${1:-cainta_photography_mis.sql}"
DB_HOST="${DB_HOST:-${MYSQLHOST:-127.0.0.1}}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-${MYSQLUSER:-root}}"
DB_PASSWORD="${DB_PASSWORD:-${MYSQLPASSWORD:-}}"
DB_NAME="${DB_NAME:-${MYSQLDATABASE:-cainta_photography_mis}}"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "SQL file not found: $SQL_FILE"
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql CLI is not installed or not in PATH."
  echo "Install it or run this command from Railway shell / your local MySQL client environment."
  exit 1
fi

if [[ -n "$DB_PASSWORD" ]]; then
  mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASSWORD" "$DB_NAME" < "$SQL_FILE"
else
  mysql --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" "$DB_NAME" < "$SQL_FILE"
fi

echo "Database import completed successfully: $DB_NAME"
