# FRC Fantasy

Fantasy sports for FIRST Robotics Competition — draft FRC teams instead of athletes,
score points from their real event performance (rankings, OPR/EPA, alliance
selection, awards) via [The Blue Alliance](https://www.thebluealliance.com/apidocs)
and [Statbotics](https://statbotics.io).

## Status

Foundational build. Fully working: auth, league creation/joining (including the
Weekly Event Draft topology), and the Team Analytics Hub with real TBA/Statbotics
data. The database schema covers every subsystem in the product spec, but the draft
room, scoring engine, and trade market are stubbed (real schema, `NOT_IMPLEMENTED`
routers) pending a follow-up build.

## Stack

Bun · TypeScript · React + Vite + TanStack Router · tRPC · Postgres + Drizzle ORM.
Single Docker container, deployed via Coolify.

## Project layout

```
apps/web       React frontend
apps/server    Bun + tRPC backend (also serves web's built assets)
packages/db    Drizzle schema + client — the source of truth for data shape
packages/shared  zod schemas + types shared between frontend and backend
```

## Getting started

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `TBA_API_KEY` (free
   key at https://www.thebluealliance.com/account).
2. `bun install`
3. `bun run db:migrate`
4. `bun run dev` — starts the backend (port 3000) and the Vite dev server, which
   proxies `/api` and `/ws` to it.

Run the ingestion job manually at any time with `bun run jobs:ingest`.
