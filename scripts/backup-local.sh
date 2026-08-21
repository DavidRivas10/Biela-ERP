#!/usr/bin/env bash

set -euo pipefail

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

backup_root="${BIELA_BACKUP_DIR:-$repo_dir/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$backup_root/$timestamp"
mkdir -p "$target"

echo "Creating PostgreSQL backup in $target"
docker compose --project-directory "$repo_dir" exec -T postgres \
  pg_dump --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --format=custom \
  > "$target/postgres.dump"

echo "Creating MongoDB backup in $target"
docker compose --project-directory "$repo_dir" exec -T mongodb \
  mongodump --quiet --archive --gzip \
  --username "$MONGO_INITDB_ROOT_USERNAME" \
  --password "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --db "$MONGO_DATABASE" \
  > "$target/mongo.archive.gz"

test -s "$target/postgres.dump"
test -s "$target/mongo.archive.gz"
sha256sum "$target/postgres.dump" "$target/mongo.archive.gz" > "$target/SHA256SUMS"
chmod -R go-rwx "$target"

echo "Backup complete: $target"
echo "Files are local-only and ignored by Git."
