# Deploying Circles

Roughly 40 minutes end to end. Order matters — Supabase first, Vercel second, then
point auth back at the live domain. Doing Vercel first means a deploy that can't sign
anyone in.

---

## 1 · Supabase project (10 min)

New project at [supabase.com/dashboard](https://supabase.com/dashboard), free tier.
In the SQL editor, run these in order:

```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_rls.sql
supabase/migrations/0003_functions.sql
supabase/seed.sql          <- optional, defines dev_seed() for demo data
```

Project Settings → API gives you the project URL and the `anon` key. Keep that tab open.

---

## 2 · Auth: use Google, not email links

This is the one decision that determines whether your friends can actually sign up.

Supabase's built-in email sender is shared infrastructure with a hard rate limit of a
few messages per hour, and it is explicitly not meant for production. Five friends
signing up the same evening will hit that ceiling, and the failure mode is silent — the
link simply never arrives, which is the worst possible first impression. Google sign-in
sends no email at all, so it sidesteps the problem entirely.

1. Google Cloud console → APIs & Services → Credentials → Create OAuth client ID → Web
   application.
2. Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback` — this
   is Supabase's callback, not your app's. You do **not** add your Vercel domain here.
3. Paste the client ID and secret into Supabase → Authentication → Providers → Google.

Leave email magic links enabled as a fallback for anyone without a Google account. If
you ever want to rely on them, add custom SMTP — Resend's free tier covers 3,000 emails a
month and takes about five minutes to wire into Supabase → Project Settings → Auth → SMTP.

---

## 3 · Push to GitHub

```bash
git add -A
git commit -m "Circles: initial app"
git push -u origin main
```

---

## 4 · Vercel (10 min)

[vercel.com](https://vercel.com) → Add New → Project → import `AbirRahaman/Circles`.
Next.js is detected automatically; no build settings to change.

Set environment variables before the first deploy:

| Variable | Value | Needed for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | your project URL | everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `anon` key | everything |
| `NEXT_PUBLIC_SITE_URL` | your Vercel URL | auth redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key | the reminder cron |
| `CRON_SECRET` | `openssl rand -hex 16` | the reminder cron |
| `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` | Splitwise only |

You won't know the Vercel URL until the first deploy, so deploy once, copy the domain,
set `NEXT_PUBLIC_SITE_URL` to it, and redeploy. Two deploys is normal.

The `service_role` key bypasses row-level security completely. It belongs in Vercel's
environment variables and nowhere else — never in the repo, never in a `NEXT_PUBLIC_`
variable.

---

## 5 · Point auth at the live domain

Supabase → Authentication → URL Configuration:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: add `https://your-app.vercel.app/**` and keep
  `http://localhost:3000/**` so local development still works.

Skip this and sign-in completes but bounces users to the wrong origin.

---

## 6 · The album reminder cron

`vercel.json` already schedules `/api/cron/album-reminders` daily at 17:00 UTC. Vercel
sends `Authorization: Bearer $CRON_SECRET` automatically once that variable is set, and
the route rejects anything else. Hobby plan allows one cron run per day, which is exactly
what's configured.

The route currently finds due reminders and marks them sent; wiring up actual push or
email delivery is the TODO inside it.

---

## Two things that will bite you later

**Free-tier Supabase pauses after 7 days with no activity.** A friend-group app is
precisely the usage pattern that trips this — nobody opens it for a week, then someone
does and the link is dead. The daily cron keeps the database warm, but only if
`CRON_SECRET` is set; without it the route returns 401 before ever touching the database,
so it protects nothing and warms nothing.

**Email rate limits**, per section 2. Google sign-in avoids it; custom SMTP fixes it.

---

## Test checklist

Run in this order — each step depends on the one before. You need two accounts, so use a
private window or a second browser profile for the member.

### Registration

- [ ] Open the deployed URL signed out → you land on `/login`
- [ ] Sign in with Google → you land on the empty groups screen
- [ ] Supabase → Table editor → `profiles`: one row, `name` populated from your Google
      account rather than a chopped-up email

### Group creation and admin rights

- [ ] Create a group → you land inside it
- [ ] `friend_groups`: one row. `invites`: one row with a token. `memberships`: your row
      with `role = admin`, `status = active`, `joined_at` set
- [ ] Settings shows the rename field; People shows an invite link

### A second member, and whether RBAC actually holds

- [ ] Second browser, second Google account, paste the invite link, join
- [ ] `memberships`: a second row, `role = member`, `status = active`
- [ ] As the member: Settings shows **no** rename field, People shows no Manage buttons
- [ ] As the member, leave the group → the row flips to `status = left` with `left_at`
      set, and is **not** deleted
- [ ] Rejoin with the same link → a **new** membership row appears; the old `left` row is
      still there. This is the history rule working

### Challenges

- [ ] Create one: unit `miles`, target `100`, per person, date range spanning today
- [ ] Log an entry as each account → leaderboard reorders, progress bar moves
- [ ] Check the arithmetic: target 100 per person × 2 active members = a goal of 200
- [ ] In SQL, set `end_date` to yesterday → it moves to Finished and the log form
      disappears

### Events, since they're the heart of it

- [ ] Create an event with three time options
- [ ] Vote from both accounts; tallies and "best so far" update
- [ ] Confirm a time as the creator → yes and maybe voters appear as RSVPs automatically
- [ ] The member sees RSVP controls but no confirm buttons
