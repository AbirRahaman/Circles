# Circles

Friend-group coordination: plans, money, photos and challenges, one place per group.
Mobile-first web app. A single person belongs to any number of independent groups.

## Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 15 App Router, React 19, TypeScript | Server components mean the group screens render from one round trip, no client data layer |
| Data | Supabase Postgres | The RBAC matrix maps onto row-level security, so permissions live in the database |
| Auth | Supabase Auth — email link, Google, Apple | `auth.uid()` is what every RLS policy reads |
| Styling | Tailwind, tokens in `globals.css` | Light and dark both defined as token sets |
| Money | Splitwise REST API | Source of truth stays with Splitwise; we read balances live and cache 5 minutes |

## Running it

```bash
npm install
cp .env.example .env.local     # fill in the Supabase values
npm run dev
```

Supabase is hosted, so the dev server is the only process you run — there is no separate
backend. But every screen is behind sign-in and scoped to a group, so an empty database
gets you the login form and nothing else.

**[docs/running-locally.md](docs/running-locally.md)** walks through the whole thing: the
hosted route, the local-Docker route, and the no-backend route for pure visual work. It
also maps which file to open for each part of the UI.

Short version — create a Supabase project, run these in the SQL editor in order, enable
the Email provider, then `select dev_seed('you@example.com');` after your first sign-in to
fill the app with a demo group:

```
supabase/migrations/0001_schema.sql      tables, enums, the signup trigger
supabase/migrations/0002_rls.sql         row-level security — the whole RBAC matrix
supabase/migrations/0003_functions.sql   membership transitions and confirm-a-time
supabase/seed.sql                        defines dev_seed() for local demo data
```

Deploying it for real: **[docs/deploying.md](docs/deploying.md)** — Supabase, Vercel, the
auth-provider decision that matters, and a test checklist.

## What is wired up

- **Groups and membership.** Create a group (you become admin), share the invite link,
  people join through `/join/<token>`. Leaving sets `status = left` and keeps the row;
  rejoining inserts a new one, so history never loses a name.
- **Events, end to end.** Propose 1–5 time options → everyone votes yes/no/maybe → the
  creator or an admin confirms one by hand → yes and maybe voters carry over as RSVPs →
  the event flips to RSVP mode. Cancel and reopen are both there.
- **Challenges.** Create with a unit, an optional per-person or group target, and a date
  range. Members log entries; leaderboard and progress bar are computed from them. A
  challenge past its end date goes read-only on its own.
- **Album links.** Paste an iCloud Shared Album URL, optionally against an event. Any
  album whose event ended more than 24h ago and was never nudged shows a reminder on the
  Plans tab; `/api/cron/album-reminders` is the scheduled version of the same query.
- **People and roles.** Promote, demote, remove, rotate the invite link — all admin-gated
  in the UI *and* in the database.

## What is stubbed, and where

| Thing | State | File |
|---|---|---|
| Splitwise OAuth | Routes written, needs your app credentials; picks your first Splitwise group rather than showing a picker | `src/app/api/splitwise/**` |
| Push notifications | The cron route finds due reminders and marks them sent; the actual send is a TODO | `src/app/api/cron/album-reminders/route.ts` |
| Adding expenses | Deep-links to Splitwise, as specced for v1 | `src/app/g/[groupId]/money/page.tsx` |
| Partiful | Out of scope — no public API | — |

## Permission model

Two roles, `admin` and `member`. Every group-scoped write proves active membership first,
and admin-gated actions additionally prove the role — enforced by RLS policies in
`0002_rls.sql`, not by route handlers. The functions in `0003_functions.sql` run
`security definer` because they legitimately cross that line (someone following an invite
link is not a member yet), and each re-checks permission itself before writing.

Membership transitions never delete rows. `memberships_one_live` is a partial unique index
that allows one live row per user per group while keeping every historical `left` row.

## Next steps

1. A Splitwise group picker instead of taking the first one, and a signed `state` parameter.
2. Realtime: subscribe to `event_votes` so a poll updates while people are looking at it.
3. Notification delivery (Expo push or Resend) inside the cron route.
4. `supabase gen types typescript` to replace the hand-written types in `src/lib/types.ts`.
