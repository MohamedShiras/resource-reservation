# Reserve

Resource Reservation Management System for shared workspaces, facilities, and equipment.

## Local development

1. Copy `.env.example` to `.env.local`, replace the PostgreSQL username/password, and set a `SESSION_SECRET` with at least 32 characters.
2. Start PostgreSQL on port `5433` and create the `reservations` database.
3. Apply the SQL migration from `db/migrations/001_init.sql` (coming in the database foundation slice).
4. Run `npm run dev` and open [http://localhost:3000](http://localhost:3000).

The application uses Next.js App Router, strict TypeScript, PostgreSQL through `pg`, and server-side services/repositories rather than an ORM.

To verify the PostgreSQL connection after starting the app, open `/api/health/db`. A successful response is:

```json
{ "ok": true, "database": "connected" }
```

The overview page currently contains presentation-only empty states. It will not show database rows until repositories and server components are wired to the schema.

## Commands

- `npm run dev` - start the development server
- `npm run lint` - run ESLint
- `npm run typecheck` - run TypeScript checks
- `npm test` - run the Vitest suite
