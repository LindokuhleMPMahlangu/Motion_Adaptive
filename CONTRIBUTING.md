# Contributing to Valence Health

Thanks for your interest in contributing to Valence Health! This document covers the basics for getting started, coding standards, and how to submit changes.

## Quick start

1. Fork the repository and clone your fork.
2. Copy `.env.example` to `.env` and fill in your Supabase / Lovable Cloud credentials.
3. Install dependencies with `bun install`.
4. Run the dev server with `bun run dev`.
5. Visit the local URL (usually `http://localhost:8080`).

> For more detailed setup, see [DEVELOPMENT.md](./DEVELOPMENT.md).

## Tech stack

- TanStack Start v1 (React 19 + Vite 7)
- Tailwind CSS v4 with OKLCH semantic tokens
- Lovable Cloud (Supabase) backend
- TypeScript, strict mode

## Coding standards

- **TypeScript**: keep strict mode happy. No `any` without a comment explaining why.
- **Components**: use existing shadcn/ui primitives under `src/components/ui/` when possible.
- **Styling**: rely on CSS variables (`--primary`, `--alert`, etc.) and Tailwind utilities. Avoid hardcoded hex colors.
- **Server functions**: use `createServerFn` from `@tanstack/react-start`. Load `supabaseAdmin` only inside handlers.
- **Database**: every new `public` table needs `GRANT`, `ENABLE ROW LEVEL SECURITY`, and `CREATE POLICY` in the same migration.
- **Security**: roles live in `user_roles`, never on the `profiles` or `auth.users` rows.

## Branching & commits

- Create a feature branch from `main`: `git checkout -b feature/my-feature`.
- Write clear, descriptive commits.
- Keep PRs focused on one change at a time.

## Pull request process

1. Ensure the project builds: `bun run build`.
2. Run the linter: `bun run lint`.
3. Format code: `bun run format`.
4. Fill out the PR template thoroughly.
5. Request review from a maintainer.

## Reporting issues

Use the GitHub issue templates. Include:

- Steps to reproduce
- Expected vs actual behavior
- Browser / OS versions
- Screenshots if relevant

## Security

If you discover a security issue, please open a private security advisory rather than a public issue.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
