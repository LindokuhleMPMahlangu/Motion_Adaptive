# Valence Health — Development Guide

This guide is for developers who want to run, build, or extend the Valence Health queue-management app locally.

## Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 20+
- A Lovable Cloud (Supabase) project with the required schema

## Environment setup

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Fill in your Supabase credentials:

   ```bash
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   VITE_SUPABASE_PROJECT_ID=your-project-id
   ```

   Server-side credentials (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`) are injected at runtime by Lovable Cloud.

## Install dependencies

```bash
bun install
```

## Run the dev server

```bash
bun run dev
```

The app is usually available at `http://localhost:8080`.

## Build

```bash
bun run build
```

For a development-mode build:

```bash
bun run build:dev
```

## Preview the production build

```bash
bun run build
bun run preview
```

## Lint and format

```bash
bun run lint
bun run format
```

## Database migrations

Migrations live in `supabase/migrations/`. Apply them in order with the Supabase CLI:

```bash
supabase migration up
```

Or run the SQL files directly against your database.

## Project structure

```
public/                  # Static assets
src/
  components/            # Reusable components
  integrations/supabase/ # Supabase clients, auth middleware, types
  lib/                   # Utilities (auth, sound, time)
  routes/                # TanStack Start routes
  styles.css             # Tailwind v4 + design tokens
supabase/migrations/     # Database schema
```

## Auth roles

- `patient` — default, can book and manage their own queue.
- `staff` — can access the staff console and trends.
- `admin` — full access.

To create a staff account, sign up at `/auth?mode=signup&role=staff` or manually insert a `user_roles` row for an existing user.

## Common tasks

### Add a new route

Create a file under `src/routes/` following the TanStack Start file-based routing convention. The route tree is auto-generated.

### Add a server function

Create or edit a `*.functions.ts` file in a client-safe path (e.g., `src/lib/`). Use `createServerFn` from `@tanstack/react-start` and validate inputs with Zod.

### Update the database schema

Create a new migration file in `supabase/migrations/` with a timestamp prefix. Remember `GRANT`, `ENABLE ROW LEVEL SECURITY`, and `CREATE POLICY` for every new `public` table.

## Troubleshooting

- **Build fails with `Unauthorized`**: a protected server function is being called from a public route loader. Move the call into the component or place it under `_authenticated/`.
- **Missing env vars**: check that `.env` is populated and restart the dev server.
- **Styles look wrong**: ensure `src/styles.css` imports are intact and Tailwind v4 is processing the file.

## Need help?

Open an issue with the `question` label or reach out to the maintainers.
