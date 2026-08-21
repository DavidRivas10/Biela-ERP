# BIELA Traditional ERP Release Checklist

`COMPLETE` means repository engineering evidence exists. `PENDING HUMAN` means
Codex is intentionally prohibited from the external action.

| Gate | Status | Evidence / action |
| --- | --- | --- |
| Starting repository clean | COMPLETE | `main` and `origin/main` at `4cf3273`; Phase 12 committed before Phase 13 edits |
| Phase 13 repository clean | PENDING HUMAN | Review and commit this intentionally uncommitted closure diff |
| Migrations | COMPLETE | 13 historical migrations, zero Phase 13 migrations; final status required |
| `.env.example` | COMPLETE | Required safe example values documented; actual `.env` ignored/untracked |
| Docker databases | COMPLETE | MongoDB 7 and PostgreSQL 16 health checks in Compose |
| Clean local startup | COMPLETE | One verified listener per app on 4000, 4001, 4002 and 5173; all health checks returned 200 |
| Admin seed | COMPLETE | Idempotent, controlled permissions, password not printed |
| Lint | COMPLETE | Final command evidence recorded at handoff |
| Backend unit tests | COMPLETE | Final command evidence recorded at handoff |
| Frontend tests | COMPLETE | Final command evidence recorded at handoff |
| Backend E2E | COMPLETE | Final command evidence recorded at handoff |
| Concurrency | COMPLETE | 5 files / 22 scenarios in E2E evidence |
| Phase 12 functional evidence | COMPLETE | 79 PASS / 0 FAIL / 0 BLOCKED |
| Build | COMPLETE | All workspaces; bundle warning documented |
| Browser smoke verification | COMPLETE | Real login and Cash Movement ledger; 143 records across 8 pages; no overlay, console error or horizontal overflow |
| Swagger / Postman | COMPLETE | Live 188 paths / 262 operations across three APIs; 75 consolidated requests |
| Dependency audit | COMPLETE | Production audit final result recorded at handoff |
| Secret/repository hygiene | COMPLETE | Tracked files and secret-pattern scan; no tracked `.env`/dumps/logs |
| Documentation index | COMPLETE | `docs/README.md` |
| Architecture / ER diagrams | COMPLETE | `architecture.md`, `data-model.md` |
| User manual | COMPLETE | `user-manual-es.md` |
| Admin manual | COMPLETE | `admin-manual-es.md` |
| Operations / troubleshooting | COMPLETE | `operations-guide.md`, `troubleshooting.md` |
| Backup procedure | COMPLETE | `backup-restore.md`, safe local scripts |
| Restore verification | COMPLETE | Disposable targets only; exact result recorded at handoff |
| Jira reconciliation documentation | COMPLETE | `phase-13-jira-reconciliation.md` |
| External Jira synchronization | PENDING HUMAN/AUTHORIZED TOOL | No external mutation authorized |
| GitHub final commit | PENDING HUMAN | Review and commit Phase 13 |
| Push and remote-main verification | PENDING HUMAN | Push approved commit and verify remote |
| Stable tag / optional GitHub Release | PENDING HUMAN | Recommended `v1.0.0`; human approval required |
| Demo | READY; PENDING HUMAN DELIVERY | `demo-script-es.md`; use generated/local data only |
| Known limitations | COMPLETE | Release notes distinguish deferred scope from defects |
