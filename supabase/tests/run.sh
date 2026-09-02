#!/usr/bin/env bash
# Applies the Supabase migrations to a throwaway local PostgreSQL database and
# checks that Row Level Security really isolates one account from another.
#
#   supabase/tests/run.sh
#
# Needs a local PostgreSQL server and permission to create a database. On
# Debian/Ubuntu: sudo apt-get install -y postgresql
set -euo pipefail

cd "$(dirname "$0")/../.."

DB="${MACRONAUT_TEST_DB:-macronaut_rls_test}"

# Run psql as whichever account can actually create databases.
if [ -n "${PGHOST:-}${PGUSER:-}" ]; then
  psql_run() { psql -X -q -v ON_ERROR_STOP=1 "$@"; }
else
  psql_run() { sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 "$@"; }
fi

psql_run -d postgres -c "DROP DATABASE IF EXISTS ${DB};" >/dev/null
psql_run -d postgres -c "CREATE DATABASE ${DB};" >/dev/null

psql_run -d "${DB}" <supabase/tests/auth_stub.sql >/dev/null
for migration in supabase/migrations/*.sql; do
  echo "applying $(basename "${migration}")"
  psql_run -d "${DB}" <"${migration}" >/dev/null 2>&1
done

# Re-apply to prove the migrations are idempotent: a user who runs the SQL
# editor twice should not get an error or a changed schema.
for migration in supabase/migrations/*.sql; do
  psql_run -d "${DB}" <"${migration}" >/dev/null 2>&1
done
echo "migrations are idempotent"

echo
output=$(psql_run -d "${DB}" --pset=footer=off <supabase/tests/rls.sql)
echo "${output}"

if grep -qi ' f$\| f |\|false' <<<"${output}"; then
  echo
  echo "FAIL: a row-level security check did not pass"
  exit 1
fi

echo
echo "PASS: every account isolation check held"
psql_run -d postgres -c "DROP DATABASE ${DB};" >/dev/null
