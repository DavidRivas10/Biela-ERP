#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: $0 BACKUP_DIR TARGET_POSTGRES_DB TARGET_MONGO_DB --confirm" >&2
  echo "Targets must be new disposable database names and cannot equal the configured primary databases." >&2
}

if [[ $# -ne 4 || "$4" != "--confirm" ]]; then
  usage
  exit 2
fi

backup_dir="$(realpath "$1")"
target_postgres_db="$2"
target_mongo_db="$3"
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$repo_dir/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$repo_dir/.env"
  set +a
fi

required=(POSTGRES_USER POSTGRES_DB MONGO_INITDB_ROOT_USERNAME MONGO_INITDB_ROOT_PASSWORD MONGO_DATABASE)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
done

if [[ ! "$target_postgres_db" =~ ^[a-zA-Z][a-zA-Z0-9_]{0,62}$ ]] ||
   [[ ! "$target_mongo_db" =~ ^[a-zA-Z][a-zA-Z0-9_-]{0,62}$ ]]; then
  echo "Unsafe target database name." >&2
  exit 2
fi
if [[ "$target_postgres_db" == "$POSTGRES_DB" || "$target_mongo_db" == "$MONGO_DATABASE" ]]; then
  echo "Refusing to restore over a configured primary database." >&2
  exit 2
fi

postgres_dump="$backup_dir/postgres.dump"
mongo_archive="$backup_dir/mongo.archive.gz"
checksums="$backup_dir/SHA256SUMS"
test -s "$postgres_dump"
test -s "$mongo_archive"
if [[ -f "$checksums" ]]; then
  (cd "$backup_dir" && sha256sum --check SHA256SUMS)
fi

postgres_exists="$(docker compose --project-directory "$repo_dir" exec -T postgres \
  psql --username "$POSTGRES_USER" --dbname postgres --tuples-only --no-align \
  --command "SELECT 1 FROM pg_database WHERE datname = '$target_postgres_db';")"
if [[ "$postgres_exists" == "1" ]]; then
  echo "Refusing to overwrite existing PostgreSQL database: $target_postgres_db" >&2
  exit 2
fi

mongo_exists="$(docker compose --project-directory "$repo_dir" exec -T mongodb \
  mongosh --quiet --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin \
  --eval "db.getMongo().getDBNames().includes('$target_mongo_db')")"
if [[ "$mongo_exists" == "true" ]]; then
  echo "Refusing to overwrite existing MongoDB database: $target_mongo_db" >&2
  exit 2
fi

echo "Restoring PostgreSQL into disposable target $target_postgres_db"
docker compose --project-directory "$repo_dir" exec -T postgres \
  createdb --username "$POSTGRES_USER" "$target_postgres_db"
docker compose --project-directory "$repo_dir" exec -T postgres \
  pg_restore --username "$POSTGRES_USER" --dbname "$target_postgres_db" \
  --no-owner --no-privileges < "$postgres_dump"

echo "Restoring MongoDB into disposable target $target_mongo_db"
docker compose --project-directory "$repo_dir" exec -T mongodb \
  mongorestore --quiet --archive --gzip \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --nsFrom "$MONGO_DATABASE.*" --nsTo "$target_mongo_db.*" \
  < "$mongo_archive"

echo "Restore complete. Both targets are disposable and were not pre-existing."
echo "Verify them, then remove them explicitly when no longer needed."
