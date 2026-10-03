# Socius

Group planning app — games, tallies, polls, and event coordination.

## Stack

- Next.js 15 App Router (TypeScript)
- Supabase Postgres with RLS
- Tailwind CSS with CSS custom-property tokens
- Fraunces (display) + Plus Jakarta Sans (body) via next/font/google
- Deployed on Vercel at usesocius.com

## UI/UX skills

Taste, a11y, bans, voice, and icon library for this project live in `.ux-profile.md`.
Run `setup-ui-ux-skills` again only to change those defaults.
Before UI or microcopy work, read `.ux-profile.md`, then the matching domain skill (page-patterns, viewports, forms, surfaces, loaders, empty-states, copy, motion).
Before creating a new page, read `page-patterns` and name the pattern. Do not write page markup until the pattern is named.
Layouts must pass `viewports` at 375px and 1280px.
Before finishing UI, run `ux-audit`.

## Security constraints

- `service_role` key only in Vercel env — never in repo or `NEXT_PUBLIC_`
- Calendar feed token is a credential
- Don't store event details from any future calendar import (only busy/free)
- Tally compliance: title is plain free-text with zero built-in presets/suggestions; no alcohol/substance defaults, seed data, or status states anywhere in the feature; demo/reviewer account must use neutral content only

## Architecture notes

- Cookie-based guest identity (`socius_guest`, httpOnly, 1 year, nanoid(16))
- Append-only event log for games with sequence numbers
- Pure function game engines (ridethebus.ts, screwyourneighbor.ts)
- Action overrides pattern: game components accept optional `actionOverrides` prop
- Parallel tables for ad-hoc games (adhoc_games / adhoc_players / adhoc_events)
- Supabase Realtime subscriptions for game_events and adhoc_events
