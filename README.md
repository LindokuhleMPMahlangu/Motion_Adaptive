# MA Health

A full-stack queue-management app for hospitals, clinics, and pharmacies, designed to combat long healthcare queues (G13 problem). Patients can book in advance, scan themselves in on arrival, track their live queue position, and check themselves out. Staff manage the live queue from a clinical console, receive audible and visual alerts when waits exceed a facility's norm, and use the Stats & Trends tab to pull past data and identify areas of improvement.

> **Live preview:** `https://motionadaptive.app`

---

## Table of contents

1. [Problem statement](#problem-statement)
2. [Solution highlights](#solution-highlights)
3. [Tech stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Database schema](#database-schema)
6. [Authentication & roles](#authentication--roles)
7. [Patient flow](#patient-flow)
8. [Staff flow](#staff-flow)
9. [Alert system](#alert-system)
10. [Stats & trends](#stats--trends)
11. [Getting started](#getting-started)
12. [Environment variables](#environment-variables)
13. [Available scripts](#available-scripts)
14. [Design system](#design-system)
15. [Security notes](#security-notes)
16. [License](#license)
17. [Features](#features)

---

## Problem statement

Long, uncertain waiting times are a daily source of patient dissatisfaction and operational inefficiency in healthcare. MA Health turns the waiting room into a transparent, patient-led flow where the queue is visible in real time, and staff are alerted the moment a patient waits beyond the accepted norm.

---

## Solution highlights

- **Scan in, scan out** — Every visit begins with an entry scan and ends with an exit scan; in/out times are recorded automatically.
- **Book in advance** — Patients can reserve a future slot at a facility and scan themselves in when they arrive.
- **Emergency scan-in** — When it cannot wait, patients can fast-path into triage with one tap.
- **Live queue tracking** — Patients see their current position, how many people are ahead, and an estimated remaining wait.
- **Proactive patient interaction** — Patients join, cancel, and manage their queue from their own device.
- **Over-norm alerts** — A two-tone alarm plus a flashing visual banner fires when a patient exceeds the facility norm; staff must log the cause and prevention step.
- **Stats & Trends** — Staff can pull the last 14 days of data, view average wait and volume charts, and review recurring delay causes for continuous improvement.

---

## Tech stack

| Layer           | Technology                                                |
| --------------- | --------------------------------------------------------- |
| Framework       | TanStack Start v1 (full-stack React 19, Vite 7)           |
| UI library      | React 19, TypeScript                                      |
| Styling         | Tailwind CSS v4, OKLCH semantic tokens, custom animations |
| Components      | Radix UI primitives + shadcn/ui patterns                  |
| Data fetching   | TanStack Query                                            |
| Backend         | Lovable Cloud (Supabase) — PostgreSQL + Auth + Realtime   |
| Charts          | Recharts                                                  |
| Icons           | Lucide React                                              |
| Form validation | Zod                                                       |
| Toasts          | Sonner                                                    |

---

## Project structure

```
.
├── public/                     # Static assets, robots.txt
├── src/
│   ├── assets/                 # Hero image and other image assets
│   ├── components/
│   │   ├── brand.tsx           # Logo component
│   │   ├── staff-trends.tsx    # Stats & trends charts and insight cards
│   │   └── ui/                 # shadcn/ui primitive components
│   ├── integrations/supabase/
│   │   ├── client.ts           # Browser Supabase client
│   │   ├── client.server.ts    # Service-role client (admin-only)
│   │   ├── auth-middleware.ts  # Server-function auth middleware
│   │   ├── auth-attacher.ts    # Attaches auth headers to server functions
│   │   └── types.ts            # Generated Supabase types
│   ├── lib/
│   │   ├── alert-sound.ts      # Web Audio API alarm generator
│   │   ├── auth.tsx            # Auth context, useAuth hook, role loading
│   │   └── time.ts             # Date/time formatting helpers
│   ├── routes/
│   │   ├── __root.tsx          # Root layout, providers, error/not-found boundaries
│   │   ├── index.tsx           # Landing page (marketing site)
│   │   ├── auth.tsx            # Sign-in / sign-up page
│   │   └── _authenticated/
│   │       ├── route.tsx       # Auth-guarded layout with navigation
│   │       ├── app.tsx         # Patient dashboard
│   │       └── staff.tsx       # Staff console + trends
│   ├── router.tsx              # TanStack Router bootstrap
│   ├── start.ts                # TanStack Start instance with middleware
│   └── styles.css              # Tailwind v4 entry + theme tokens
├── supabase/
│   ├── config.toml             # Supabase local configuration (auto-generated)
│   └── migrations/               # SQL migrations
│       ├── 20260618231353_f10dad4c-a4e7-48eb-ad43-e746ffb71f64.sql  # Core schema + seed
│       ├── 20260618231411_356a00ce-7a7a-4cc9-baca-bf52c2e8f9e9.sql  # Function grants
│       └── 20260618231824_0c55aa3d-d93f-436d-885b-ac5e5398d922.sql  # Queue status RPC v2
├── .env                        # Vite / Supabase environment variables
├── package.json
├── README.md
├── tsconfig.json
└── vite.config.ts
```

---

## Database schema

### Core tables

| Table           | Purpose                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`      | One-to-one extension of `auth.users`; stores `full_name`.                                                                         |
| `user_roles`    | Separate role table (patient, staff, admin). Roles are never stored on the user row.                                              |
| `facilities`    | Hospitals, clinics, and pharmacies with norm wait time, average service time, and services list.                                  |
| `queue_entries` | A patient’s booking or live queue entry. Tracks status, emergency flag, booked-for time, check-in/out timestamps, and alert flag. |
| `alert_logs`    | Root-cause log for over-norm delays, including cause, prevention step, and wait minutes.                                          |

### Key functions

- `public.has_role(_user_id, _role)` — SECURITY DEFINER helper used inside RLS policies to avoid recursion.
- `public.get_my_queue_status()` — SECURITY DEFINER RPC that returns the current patient’s live queue position, people ahead, total waiting, estimated wait, and norm wait time.
- `public.handle_new_user()` — Trigger that creates a profile and default role (`patient` or metadata-driven `staff`/`admin`) on sign-up.

### Realtime

`queue_entries` and `alert_logs` are added to the `supabase_realtime` publication so dashboards update without a manual refresh.

---

## Authentication & roles

- Authentication is handled by Lovable Cloud (Supabase Auth) via email/password.
- New users are auto-provisioned with a `profiles` row and a `user_roles` row.
- Sign-up can be marked as `patient` or `staff` via `role` metadata.
- The `useAuth` hook exposes the current `user`, `role` (`patient` | `staff` | `admin`), `fullName`, `signOut`, and `refresh`.
- The `_authenticated` route layout guards all app pages and redirects unauthenticated users to `/auth`.
- The staff console further checks `role` and redirects non-staff/non-admin users to `/app`.

---

## Patient flow

1. **Sign up / sign in** at `/auth`. New patients are given the `patient` role.
2. **My Queue (`/app`)** shows:
   - Live status card with current position, total waiting, elapsed wait, and estimated remaining time.
   - A list of upcoming advance bookings with a **Scan in** button.
   - Recent visit history with actual wait durations.
3. When not in a queue, the patient can:
   - **Scan in now** — join the live queue immediately (walk-in).
   - **Reserve a slot** — choose a date and time and book in advance.
   - **Emergency scan-in** — mark the entry as an emergency and fast-track to the front of the triage queue.
4. While checked in, the patient can **Scan out** or **Leave queue**.
5. If the elapsed wait exceeds the facility’s `norm_wait_minutes`, the patient sees an over-norm warning and a two-tone alarm sounds once.

---

## Staff flow

1. **Sign up as staff** at `/auth?mode=signup&role=staff` (or grant the `staff` role manually to an existing user via `user_roles`).
2. **Staff Console (`/staff`)** has two tabs: **Live queue** and **Stats & trends**.
3. In the **Live queue** tab:
   - Select a facility.
   - View KPIs: in queue, over norm, average throughput, norm wait.
   - See a priority-sorted queue: emergencies first, then by check-in time.
   - Call the next patient (`in_service`) or mark them done (`completed` + `checked_out_at`).
   - When any patient exceeds the norm, a flashing alert banner appears, an audible alarm plays, and a **Log cause** button opens the root-cause modal.
4. In the **Log cause** modal, staff record:
   - What caused the delay.
   - How the facility will prevent it next time.
   - This writes an `alert_logs` row and marks the entry as `alerted`.

---

## Alert system

- **Trigger:** a patient’s elapsed wait is >= the facility’s `norm_wait_minutes`.
- **Sound:** `src/lib/alert-sound.ts` uses the Web Audio API to generate a client-side, urgent two-tone alarm (880 Hz / 660 Hz) without requiring audio assets.
- **Visual:** the patient card and staff row pulse with an alert color (`--alert`).
- **Staff banner:** a full-width flashing banner shows the first overdue patient and a **Log cause** button.
- **Deduplication:** the alarm fires once per patient per session state; the patient-side alarm resets if the wait drops below the norm, the staff alarm persists per `alarmedIds` set.
- **Root-cause logging:** every over-norm event must be logged with cause and prevention before the modal closes, ensuring the issue is tracked and can be analyzed later.

---

## Stats & trends

The `StaffTrends` component (`src/components/staff-trends.tsx`) provides the last 14 days of analytics:

- **KPI cards:** Patients served, average wait, over-norm percentage, trend vs. prior half-window.
- **Average wait time area chart** — day-by-day trend against the facility norm.
- **Daily volume & over-norm bar chart** — patients served vs. delayed.
- **Areas of improvement** — recurring root causes aggregated from `alert_logs`, with the most common prevention fix shown.

This gives staff concrete, data-driven starting points for process improvement.

---

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) or Node.js 20+
- A Lovable Cloud backend project (Supabase) — the app is configured with environment variables.

### Install dependencies

```bash
bun install
```

### Environment variables

Copy `.env` and fill in your values (see [Environment variables](#environment-variables)).

### Run the dev server

```bash
bun run dev
```

The app will be available at the Vite dev URL (typically `http://localhost:8080`).

### Apply migrations

If you need to recreate the schema locally or on the Lovable Cloud backend, apply the migrations in order:

```bash
supabase migration up
```

Or run the SQL files in `supabase/migrations/` directly against the database.

---

## Environment variables

Create a `.env` file with the following variables:

```bash
# Supabase / Lovable Cloud
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

Server-side functions receive the following at runtime via Lovable Cloud:

```bash
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
```

> **Note:** Service-role credentials are managed by Lovable Cloud and are not available to download. Server-only code reads them inside request handlers, never at module scope.

---

## Available scripts

| Script    | Command             | Purpose                              |
| --------- | ------------------- | ------------------------------------ |
| Dev       | `bun run dev`       | Start the Vite dev server with HMR   |
| Build     | `bun run build`     | Production build                     |
| Build dev | `bun run build:dev` | Development-mode build               |
| Preview   | `bun run preview`   | Preview the production build locally |
| Lint      | `bun run lint`      | Run ESLint                           |
| Format    | `bun run format`    | Run Prettier                         |

---

## Design system

- **Visual direction:** MA Health clinical system — dense, legible information display with mono accents and a professional clinical aesthetic.
- **Primary palette:** OKLCH-based semantic tokens (`--primary`, `--alert`, `--success`, `--surface`, `--background`, etc.).
- **Typography:** Inter for headings and body; JetBrains Mono for timestamps, positions, and data labels.
- **Color semantics:**
  - Primary blue = action / active state
  - Alert red = overdue / emergency / attention
  - Success green = completed / on-time
- **Animations:** subtle entrance slide, slow pulse on elapsed timers, and alert throb on overdue rows.
- **Dark mode:** CSS variables fully support `.dark` theme; toggle via system preference or by adding the class to `html`.

---

## Security notes

- Row-Level Security (RLS) is enabled on every user-facing table. GRANT statements are included in each migration.
- Roles are stored in the separate `user_roles` table, never on the `profiles` or `auth.users` rows.
- Staff-only functions use `has_role()` checks at the RLS and UI layers.
- The service-role client is only loaded inside server-function handlers and `.server.ts` files; it is never imported directly by client components.
- Anonymous sign-ups are not enabled by default; the app requires explicit sign-up.

---

## License

Private / proprietary — built for the MA Health healthcare queue-management project.

---

## Next steps / roadmap ideas

- SMS/push notifications when a patient is called or when their wait is over norm.
- Multi-facility admin dashboard for regional health authorities.
- Appointment reminders and no-show analytics.
- Integration with hospital EMR or pharmacy POS systems via webhooks under `src/routes/api/public/`.
- Wait-time prediction using historical averages and live queue length.

---

The application is a fully compiled Flutter Web app served as a static site on GitHub Pages, mapped via the `CNAME` record to the custom domain above.

---

## Features

### 🏥 Queue Management
- Real-time live queue display (patient number, queue number, time IN/OUT, waiting time, status)
- Patient filtering by patient number and date range
- Paginated queue history (`/api/queue/all?page=X&size=Y`)
- Delete queue entries
- Batch live-queue status updates

### 📊 Analytics & Reporting
- Today / Yesterday / Weekly stats dashboards
- Custom date-range calculations with optional incomplete sessions
- Period-over-period comparison reports
- Automatic insights:
  - Monday high-volume pattern detection
  - Long-wait patient alerts (>60 min)
  - Peak-hour congestion warnings
  - SLA compliance tracking (20-minute target)
- Export to **CSV** and **Excel** (`Queue_Data_<date>.csv`, `Analytics_<date>.csv`)

### 🔐 User Management
- Email + password authentication via **Supabase Auth**
- Forgot password / magic-link set-password flow
- Email change with confirmation link
- Role-based access: **User** and **Admin**
- Tenant application workflow (apply → pending → approved / rejected / blocked / reinstated)

### 🛠 Admin Panel
- Application management (approve / reject / block / reinstate)
- Activity log with export and refresh
- Settings (show-blocked-by-default toggle)

### 🦴 Ortho Express Module
- Parcel listing, matching, and mass-erase operations
- Bearer-token–protected data management

### 📲 Push Notifications
- Firebase Cloud Messaging (FCM) for foreground and background messages
- Background notifications shown via service worker with vibration pattern and app icon
