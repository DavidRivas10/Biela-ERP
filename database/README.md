# Local databases

MongoDB is owned exclusively by `ms-users`; PostgreSQL is owned exclusively by
`ms-autorepuesto`. The gateway never connects to either database.

Copy `.env.example` to `.env`, choose local credentials, then start both
databases with `docker compose up -d`. Check them with `docker compose ps` and
stop them with `docker compose down`. Named volumes preserve data.

Prisma commands run from the repository root:

- `npm run prisma:generate`
- `npm run prisma:migrate -- --name <migration-name>`
- `npm run prisma:deploy`
- `npm run prisma:validate --workspace @biela/ms-autorepuesto`
- `npm run prisma:status --workspace @biela/ms-autorepuesto`

To create a future migration without applying it, run
`npm exec --workspace @biela/ms-autorepuesto dotenv -e ../../.env -- prisma migrate dev --create-only`.
Only for disposable local data, after confirming the target `DATABASE_URL`, run
`npm exec --workspace @biela/ms-autorepuesto dotenv -e ../../.env -- prisma migrate reset`. Never use
that reset command against shared or production data.
