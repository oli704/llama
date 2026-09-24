# Llama

A kid-friendly reimagining of the trips you used to take, before kids. See [DESIGN.md](./DESIGN.md) for the full technical design and the plan this was built from.

## Setup

1. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` / `DIRECT_URL` - Postgres connection strings (identical for local Postgres; see "Deploying to production" below for hosted providers).
   - `AUTH_SECRET` - generate with `npx auth secret` or `openssl rand -base64 32`.
   - `EMAIL_SERVER_*` / `EMAIL_FROM` - SMTP credentials for magic-link sign-in emails (any provider - Resend, Postmark, Gmail app password, etc. all work via SMTP).
   - `ANTHROPIC_API_KEY` - required for trip taste-profile extraction, suggestion generation, and itinerary generation.
   - `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` - optional. Get test-tier credentials from [developers.amadeus.com](https://developers.amadeus.com). Without them, suggestions still work, just without a "live flight price" line.

2. Install dependencies and push the schema to your database:

   ```bash
   npm install
   npx prisma migrate dev --name init
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

## Deploying to production

**Database: Neon.** Recommended over other options here because its free tier includes built-in connection pooling, which matters for a serverless host like Vercel - each function invocation opens its own DB connection, and plain Postgres runs out of connection slots fast under concurrent traffic. Supabase works too (same pooling story via its "Session"/"Transaction" pooler modes); Railway or a self-managed Postgres box are fine if you don't mind managing pooling yourself (e.g. adding PgBouncer).

1. Create a free account at [neon.tech](https://neon.tech) and a new project.
2. Neon gives you two connection strings - a pooled one and a direct one. Set `DATABASE_URL` to the **pooled** string and `DIRECT_URL` to the **direct** one (this project's `schema.prisma` already has a `directUrl` for this - migrations need a direct connection, the running app uses the pooled one).
3. Run migrations against it once, from your machine: `npx prisma migrate deploy` (this reads `DIRECT_URL`, not `migrate dev` - that's for local schema iteration only).

**Hosting: Vercel.** Zero-config for Next.js (this project has no custom server, so no special adapter needed).

1. Push this repo to GitHub.
2. Create a free account at [vercel.com](https://vercel.com), then "Import Project" and point it at the repo.
3. In the Vercel project's Settings → Environment Variables, add everything from your `.env`: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `EMAIL_SERVER_*`, `EMAIL_FROM`, `ANTHROPIC_API_KEY`, and (optionally) `AMADEUS_CLIENT_ID`/`AMADEUS_CLIENT_SECRET`.
4. Deploy. Vercel runs `npm install` (which now runs `prisma generate` via the `postinstall` script) then `next build` automatically. No `vercel.json` needed.
5. Auth.js auto-detects the deployed URL on Vercel for magic-link callback URLs - no `AUTH_URL` needed unless you put a custom domain in front and see redirect mismatches, in which case set `AUTH_URL` to that domain.

**Outbound email**: any SMTP provider works, but [Resend](https://resend.com) is the least fuss for a Next.js app (free tier, dead-simple SMTP credentials) if you don't already have one.

**Going forward**: whenever the schema changes, run `npx prisma migrate dev --name <description>` locally (generates a migration file against your dev DB) and commit the generated `prisma/migrations/` folder, then run `npm run db:deploy` (or wire it into your CI) to apply it to production - `next build` intentionally does not run migrations itself, so a bad migration can't take down a build.

## What's built (Phases 1-8 of the DESIGN.md build order)

- Magic-link auth (Auth.js / NextAuth v5, database sessions, Prisma adapter)
- Household + kids management, with per-kid age bands (baby/toddler/preschooler)
- Past-trip capture (free text) with LLM taste-profile extraction, shown for the user to review
- Suggestion generation: pick past trip(s) → ranked shortlist of named destinations with rationale, cost estimate, and per-age-band kid-logistics notes
- Live flight-price lookup (Amadeus Flight Offers Search, test tier) annotating each suggestion's LLM cost estimate, when the destination and home base resolve to IATA codes
- Full day-by-day itinerary generation on demand for a selected suggestion
- Save/shortlist persistence
- Mobile-responsive layout (nav, forms, and suggestion/itinerary cards verified down to 375px)

## Not yet built

- Stripe Checkout (the `Entitlement` model and the itinerary-gate seam exist in the schema; no payment flow is wired up - deliberately excluded from this pass)

## Known issue to track

`next-auth@5` is still in beta and peer-pins `nodemailer` to `^7 || ^8`. The nodemailer SSRF/file-read advisories affecting that range have no in-range fix yet, and bumping to nodemailer 10 breaks the peer dependency. Revisit when next-auth leaves beta and widens its nodemailer peer range.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Prisma + Postgres · Auth.js v5 · Anthropic SDK (Claude) · Tailwind CSS

Note: this is Next.js 16, which has real breaking changes vs. older Next docs/training data (async `params`/`cookies()`/`headers()`, `middleware.ts` renamed to `proxy.ts`, Turbopack by default). See `node_modules/next/dist/docs/` (bundled with the installed version) before assuming older Next.js patterns apply.
