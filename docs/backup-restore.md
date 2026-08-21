# BIELA Backup and Restore

BIELA has two independent databases. A complete recovery point requires one
PostgreSQL backup for `ms-autorepuesto` and one MongoDB backup for `ms-users`,
created close together and retained as a pair.

## Safe local backup

The repository scripts read credentials and database names from the ignored
`.env`; they contain no secrets. The default output is the Git-ignored
`backups/<UTC timestamp>/` directory.

```bash
./scripts/backup-local.sh
```

To write outside the repository:

```bash
BIELA_BACKUP_DIR=/absolute/safe/path ./scripts/backup-local.sh
```

The output contains `postgres.dump`, `mongo.archive.gz`, and `SHA256SUMS`.
Both dumps must be non-empty and their checksums must validate.

## Manual equivalents

PostgreSQL uses `pg_dump --format=custom`; MongoDB uses `mongodump --archive
--gzip`. Prefer the script because it invokes the matching tools inside current
Compose containers and does not expose passwords in command output. Never
store a password in a tracked shell script or Postman file.

## Restore into disposable databases

Restoration is intentionally refused when either target equals its configured
primary database or already exists. Supply two new disposable names and the
explicit confirmation flag:

```bash
./scripts/restore-local.sh backups/20260101T000000Z \
  biela_restore_verify_pg biela_restore_verify_mongo --confirm
```

The script validates checksums, creates the PostgreSQL target, restores its
custom dump, remaps the MongoDB archive namespace to the target database, and
leaves both targets available for inspection. It never overwrites the primary
development databases.

Verify PostgreSQL tables/migration history with `psql` and MongoDB collections
with `mongosh`. After verification, a database administrator may explicitly
drop only the named disposable targets. Confirm names and current connections
before doing so.

## Recovery of a real environment

Restoring into an actual environment is a maintenance operation, not a normal
development command. Stop application writes, verify the exact target, take a
fresh safety backup, validate checksums, document the selected recovery point,
and obtain human approval. The local restore script deliberately cannot restore
over configured primary names; use reviewed DBA procedures for a real recovery.

## Retention recommendation

For a small operational deployment, keep daily backups for 14 days, weekly
backups for 8 weeks, and monthly backups for 12 months, adjusted to legal and
business requirements. Store encrypted copies outside the application host,
restrict access, monitor failed jobs, and test a disposable restore regularly.
Retention policy and off-site storage remain deployment-owner decisions.

## Docker considerations

`docker compose down` preserves named volumes. `docker compose down -v` deletes
them and must never be part of ordinary shutdown. Dump files are separate from
volumes; neither replaces testing a restore. Generated dumps are ignored by Git
and must not be committed.

## Phase 13 verification evidence

On 2026-08-21 the scripts created non-empty checksum-validated dumps and
restored them into new disposable databases. PostgreSQL source/target matched
at 30 public tables, 13 applied migrations, 43 Products and 131 Payments.
MongoDB source/target matched at 39 Users and 8 Roles. The disposable databases
were then explicitly removed; both configured primary databases and the ignored
backup remained intact.
