# BIELA Documentation Index

This directory is the documentation entry point for the BIELA traditional ERP
release candidate.

## Release and closure

- [Traditional ERP release notes](release-notes-traditional-erp.md)
- [Release checklist](release-checklist.md)
- [Phase 13 closure matrix](phase-13-traditional-erp-closure-matrix.md)
- [Phase 13 Jira reconciliation](phase-13-jira-reconciliation.md)
- [Spanish demo script](demo-script-es.md)
- [Repository changelog](../CHANGELOG.md)

## Architecture and contracts

- [Architecture and seven core diagrams](architecture.md)
- [Database ownership and ER overview](data-model.md)
- [Public backend API contract](backend-api-contract.md)
- [Backend release-readiness detail](backend-release-readiness.md)
- [Backend MVP architecture and demonstration](backend-mvp.md)

## Operating BIELA

- [Manual de usuario](user-manual-es.md)
- [Manual de administración](admin-manual-es.md)
- [Technical operations guide](operations-guide.md)
- [Troubleshooting guide](troubleshooting.md)
- [Backup and restore](backup-restore.md)

## Official integration and functional evidence

- [Official Phase 11 integration report](phase-11-frontend-backend-integration.md)
- [Official Phase 11 integration matrix](phase-11-integration-matrix.md)
- [Official Phase 12 functional report](phase-12-functional-test-report.md)
- [Official Phase 12 functional matrix](phase-12-functional-test-matrix.md)

## Domain design history

- [Phase 2 catalog data model](phase-2-data-model.md)
- [Phase 3 warehouse and search model](phase-3-data-model.md)
- [Phase 5 purchasing model](phase-5-purchasing-model.md)
- [Phase 6 sales model](phase-6-sales-model.md)
- [Phase 7 Cash and Payments model](phase-7-cash-payments-model.md)
- [Phase 8 commercial integration](phase-8-commercial-integration.md)

## Frontend implementation subphases

Official Phase 10 was delivered as internal implementation subphases. These
names do not replace the official roadmap:

- [10.A foundation, authentication, Dashboard and shell](frontend-foundation.md)
- [10.B catalog, Vehicles, Compatibility, Inventory and Search](frontend-phase-10b-catalog-inventory.md)
- [10.C purchasing and payables](frontend-phase-10c-purchasing.md)
- [10.D sales and receivables](frontend-phase-10d-sales-receivables.md)
- [10.E Cash and administration](frontend-phase-10e-cash-admin.md)

## API execution assets

Credential-free Postman collections and environments are in [`postman/`](postman/).
The consolidated release flow is `BIELA-Backend-ERP`; historical Phase assets
remain for regression traceability.
