# Running Circles locally

## Does this need a backend running?

No. Supabase is hosted, so there is exactly one process on your machine — the Next.js
dev server. There is no API server, no worker, no Docker, unless you deliberately
choose the local-Supabase route in Option B below.

The wrinkle is that Circles has no public pages. Every screen sits behind sign-in and
every screen is scoped to a group, so pointing `npm run dev` at an empty database gets
you a login form and nothing else. Pick one of the three options below depending on
what you actually want to poke at.

---

## Option A — hosted Supabase (recommended, ~10 minutes)

Best for real UI work. Auth behaves like production, and you can open the app on your
phone to check the mobile layout.

**1. Create the project.** At [supabase.com/dashboard](https://supabase.com/dashboard),
new project, free tier. Note the database password somewhere.

**2. Run the migrations.** In the dashboard's SQL editor, paste and run each file in
order — they are not interchangeable, `0002` depends on tables from `0001`:

```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_functions.sql
supabase/seed.sql          <- defines dev_seed(), does not run it
```

**3. Turn on email sign-in.** Authentication → Providers → Email → enabled. Nothing
else is required; magic links work out of the box on the free tier.

**4. Wire up the app.** Project Settings → API gives you the project URL and the anon
key:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

The other variables in `.env.example` — Splitwise, encryption, cron — are only needed
for those features and can stay blank.

**5. Allow the redirect.** Authentication → URL Configuration → add
`http://localhost:3000/**` to Redirect URLs, or your magic link will bounce you to the
wrong origin after clicking it.

**6. Go.**

```bash
npm install
npm run dev
```

Open http://localhost:3000, sign in with your email, click the link in your inbox.

**7. Fill it with something.** You will land on an empty groups screen. In the SQL
editor:

```sql
select dev_seed('you@example.com');   -- the address you just signed in with
```

Refresh. You now have Cabin Crew: five members, an open poll with four people already
voted so you can vote and confirm a time, a past dinner with RSVPs, an album link with
a live reminder card, and a running challenge with a populated leaderboard.

---

## Option B — Supabase on your machine

Everything offline, and sign-in emails get caught locally instead of hitting your
inbox. Costs you a Docker dependency.

```bash
npm install -g supabase
supabase init
supabase start
```

`supabase start` prints a local API URL and anon key — put those in `.env.local`
instead of the hosted ones. `supabase db reset` applies everything in
`supabase/migrations/` plus `seed.sql` in one go. Magic-link emails land in the local
Inbucket inbox at the URL that `supabase start` prints, so you never leave your
machine. Then `select dev_seed('you@example.com');` as above.

---

## Option C — no backend at all

For pure visual tinkering — spacing, colour, type, layout — open
`docs/prototype-circles.html` in any browser. Every screen renders with sample data,
no install, no database, no sign-in. Edit the file, hit refresh.

The catch: that file is a standalone prototype, not the app. Changes there do not carry
into the Next.js code. Use it to try a layout idea in thirty seconds, then port the
decision into `src/`.

---

## Where the UI actually lives

| What you want to change | File |
|---|---|
| Colours, light and dark palettes | `src/app/globals.css` — the two `:root` blocks |
| Fonts | `src/app/layout.tsx` — swap the three `next/font/google` imports |
| Tailwind token names | `tailwind.config.ts` |
| Phone-column width, the app frame | `.shell` in `src/app/globals.css` |
| Buttons, cards, pills, avatars, progress bars | `src/components/ui.tsx` |
| Bottom tabs | `src/components/TabBar.tsx` |
| Header | `src/components/TopBar.tsx` |
| Event list row | `src/components/EventCard.tsx` |
| Vote and RSVP controls | `src/components/VoteButtons.tsx`, `RsvpControl.tsx` |
| A whole screen | `src/app/g/[groupId]/…` — one folder per tab |

Almost every colour is a CSS variable, so retheming the entire app is editing the two
`:root` blocks in `globals.css` and nothing else. Both light and dark are defined
there; your OS setting decides which you see.

---

## When something goes wrong

**Stuck on the login screen after clicking the email link.** The redirect URL is not
allowed. Add `http://localhost:3000/**` under Authentication → URL Configuration.

**Signed in, but the groups screen is empty and stays empty.** Expected until you run
`dev_seed`. Creating a group through the UI works too.

**`relation "memberships" does not exist`.** The migrations did not run, or ran out of
order. Re-run `0001`, then `0002`, then `0003`.

**A page renders but every list is empty.** Almost always row-level security doing its
job: you are signed in as someone with no active membership in that group. Check the
`memberships` table for a row with your user id and `status = 'active'`.

**`TOKEN_ENCRYPTION_KEY is not set`.** Only the Splitwise tab touches this. Either
ignore that tab or run `openssl rand -base64 32` and paste the result into
`.env.local`.

**Port 3000 is taken.** `npm run dev -- -p 3001`, and update `NEXT_PUBLIC_SITE_URL`
plus the Supabase redirect URL to match.
