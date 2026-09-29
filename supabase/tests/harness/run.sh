#!/bin/bash
# Esegue le migrazioni e i test su un Postgres usa-e-getta, senza toccare
# il database vero. Serve postgresql-16 installato e l'utente `postgres`.
#
#   sudo -u postgres supabase/tests/harness/run.sh            # tutti i test
#   sudo -u postgres supabase/tests/harness/run.sh supabase/tests/intake_test.sql
#
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
BASE="${PGTEST_DIR:-/var/tmp/pgtest}"
DATA="$BASE/data"
export PGPORT="${PGTEST_PORT:-55432}"
export PGHOST="$BASE/sock"

# pg_net non esiste fuori da Supabase: qui è un finto che registra le
# chiamate in net.calls invece di farle davvero.
EXTDIR=/usr/share/postgresql/16/extension
if [ ! -f "$EXTDIR/pg_net.control" ]; then
  cat > "$EXTDIR/pg_net.control" <<'CTL'
comment = 'stub locale per i test'
default_version = '0.1'
relocatable = false
schema = net
CTL
  cat > "$EXTDIR/pg_net--0.1.sql" <<'EXT'
create table if not exists net.calls (
  id bigserial primary key, url text, headers jsonb, body jsonb, at timestamptz default now()
);
create or replace function net.http_post(
  url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000
) returns bigint language sql as $$
  insert into net.calls (url, headers, body) values (url, headers, body) returning id
$$;
EXT
fi

rm -rf "$DATA" "$PGHOST"
mkdir -p "$DATA" "$PGHOST"
/usr/lib/postgresql/16/bin/initdb -D "$DATA" -U postgres -A trust >/dev/null
/usr/lib/postgresql/16/bin/pg_ctl -D "$DATA" \
  -o "-k $PGHOST -p $PGPORT -c listen_addresses=" -l "$BASE/log" -w start >/dev/null
trap '/usr/lib/postgresql/16/bin/pg_ctl -D "$DATA" -m immediate stop >/dev/null 2>&1 || true' EXIT

TESTS=("$@")
if [ ${#TESTS[@]} -eq 0 ]; then TESTS=("$REPO"/supabase/tests/*.sql); fi

fail=0
for t in "${TESTS[@]}"; do
  psql -U postgres -d postgres -q -c 'drop database if exists app' -c 'create database app'
  psql -U postgres -d app -v ON_ERROR_STOP=1 -q -f "$HERE/stubs.sql" >/dev/null
  for m in "$REPO"/supabase/migrations/*.sql; do
    psql -U postgres -d app -v ON_ERROR_STOP=1 -q -f "$m" >/dev/null 2>&1 \
      || { echo "MIGRAZIONE FALLITA: $m"; exit 1; }
  done
  out=$(psql -U postgres -d app -v ON_ERROR_STOP=1 -f "$t" 2>&1) || true
  if echo "$out" | grep -qE "TUTTI I TEST SUPERATI|== FINE =="; then
    echo "OK   $(basename "$t")"
  else
    echo "FAIL $(basename "$t")"
    echo "$out" | tail -15
    fail=1
  fi
done
exit $fail
