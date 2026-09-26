# Llama — Technical Design

Product spec this builds on: [i-want-to-create-merry-hopper.md](/Users/olivermitchell/.claude/plans/i-want-to-create-merry-hopper.md) (working title "Merry Hopper" in that doc — product is now **Llama**).

## 1. Stack

- **Framework**: Next.js (App Router, TypeScript) — single deployable for UI + API routes, good fit for LLM streaming responses and a later Stripe Checkout webhook.
- **DB**: Postgres, via Prisma ORM.
- **Auth**: Auth.js (NextAuth) with email magic-link — no password storage, matches "simple accounts" requirement.
- **LLM**: Claude API (Anthropic) for taste-profile extraction, suggestion generation, and itinerary generation. Same provider for all three keeps prompting/response-shape consistent.
- **Pricing data**: Amadeus Self-Service Flight Offers Search API for real flight pricing (free-tier sandbox available, good short-haul Europe coverage). Hotel/accommodation pricing deferred past v1 — cost bands for lodging estimated by the LLM initially, flagged in UI as "estimated."
- **Hosting**: Vercel (pairs naturally with Next.js) + a managed Postgres (Neon/Supabase).
- **Payments**: Stripe Billing — subscription via Stripe-hosted Checkout, customer portal, Entitlements (§6).

## 2. Data Model

```
User
  id, email, createdAt

Household  (1:1 with User for v1)
  id, userId, homeBase (free text, any city worldwide, resolved to an IATA code
  at suggestion time), budgetMin, budgetMax, budgetCurrency (3-letter code, user-set),
  tripLengthMaxDays (default 7)

Kid
  id, householdId, label (e.g. "eldest"), ageBand (BABY | TODDLER | PRESCHOOLER)

PastTrip
  id, userId, rawText, createdAt
  tasteProfile (JSON — see §4.1 shape)

SuggestionSet
  id, userId, createdAt, inputSnapshot (JSON: taste profiles + household + constraints used)

Suggestion
  id, suggestionSetId, rank, destinationName, rationale,
  estCostMin, estCostMax, costCurrency (3-letter code the LLM chose as natural for
  the home base), estTripLengthDays,
  kidRiskNotes (JSON, keyed by ageBand), saved (bool)

Itinerary
  id, suggestionId, days (JSON array of {day, activities[], kidNotes[]}),
  generatedAt

User (billing fields)
  stripeCustomerId (unique), entitlementsSyncedAt

Entitlement   -- mirror of the customer's active Stripe Entitlements
  id, userId, type (Stripe Feature lookup_key, e.g. "full-access"), grantedAt
  unique (userId, type)

Subscription  -- mirror of the user's Stripe subscription, for display
  id, userId (unique), stripeSubscriptionId (unique), stripePriceId, status,
  currentPeriodEnd, cancelAtPeriodEnd
```

Notes:
- `tasteProfile` / `kidRiskNotes` / `inputSnapshot` are JSON blobs rather than normalized tables — the shape will shift as prompts are tuned, and normalizing now would be premature.
- `Entitlement` / `Subscription` are local mirrors of Stripe state (§6); Stripe is the source of truth.

## 3. Page Flow

1. `/login` — magic-link auth.
2. `/onboarding` — first-run: add household (kids + age bands, home base, budget, trip length), add first past trip (free text).
3. `/trips` — list/add past trips; each shows its extracted taste profile for user confirmation/edit (LLM extraction isn't shown as a black box — user can see and correct "pace: slow, activity: hiking, budget: mid" etc. before it's used).
4. `/suggestions/new` — pick which past trip(s) to draw from (if multiple logged) → generates a `SuggestionSet` → ranked shortlist view (destination, rationale, cost band, risk note per kid).
5. `/suggestions/[id]` — shortlist detail; "Get full itinerary" button on each suggestion → generates `Itinerary`, shown inline, saveable.
6. `/saved` — saved suggestions + itineraries.
7. `/household` — edit household/kids/budget/constraints.

## 4. LLM Prompting Approach

### 4.1 Taste-profile extraction (per past trip)
Input: raw free text. Output: structured JSON — `{destinationType, pace, activityMix[], socialVsSolitary, budgetTier, climate, whatMadeItSpecial}`. Single call, low temperature, strict JSON schema via tool-use/structured output. Shown back to user for edit before it's stored — extraction errors are corrected at the source rather than silently propagating into suggestions.

### 4.2 Suggestion generation
Input: one or more `tasteProfile`s + household (kid age bands, budget, trip length, home base, must-avoids) + a fixed instruction to prefer named, real, currently-viable destinations reachable within the trip-length/budget constraints from the home base. Output: N ranked suggestions with rationale, cost band (LLM estimate, or the Amadeus figure once wired for flight-inclusive trips — see §5), and a kid-risk note per age band present in the household. Structured JSON output again, rendered by the UI rather than shown as raw model text.

### 4.3 Itinerary generation
Input: the selected `Suggestion` + household. Output: day-by-day structure (`days[]`, each with activities and kid-specific pacing notes — nap windows, avoid-long-transit-days, etc.). This is the heavier/slower call, only triggered on explicit user action (not pre-generated for every shortlist item), keeping suggestion-generation fast and itinerary generation on-demand.

## 5. Pricing Integration — built

LLM produces an estimated cost band for every suggestion, in whichever currency the household set (or, if unset, whichever currency the LLM judges natural for the home base — state and store the 3-letter code either way; nothing is assumed to be GBP). The suggestion-generation prompt also asks for the nearest major airport's IATA code per destination (`null` when the trip doesn't need a flight, e.g. a road trip). `src/lib/amadeus.ts` then does a best-effort Amadeus Flight Offers Search (test tier) — OAuth2 client-credentials token, ~6 weeks out, `adults=2` plus kids mapped to Amadeus's infant/child categories by age band — and annotates (not replaces) the suggestion with a "live flight price" line when it succeeds. Any failure (unresolvable home base or destination, missing/invalid API credentials, no route in the sandbox, rate limit) degrades silently to LLM-estimate-only; it never blocks suggestion creation.

**Global home base (updated from the original London-only lock)**: home base is free text for any city worldwide. `resolveIata()` in `src/lib/amadeus.ts` resolves it (and the destination) to an IATA code via Amadeus's location-search endpoint at request time, replacing the earlier hardcoded `"London" → "LON"` lookup table. This is cached in-memory per input string within a server instance's lifetime, but not persisted — a cold start re-resolves. Hotel/accommodation pricing stays LLM-estimated.

## 6. Payments — built (Full access subscription)

Follows Stripe's [Sell subscriptions as a SaaS startup](https://docs.stripe.com/get-started/use-cases/saas-subscriptions) guide. Changed from the original one-off `itinerary_unlock` plan to a flat-rate subscription: **Full access, €10/month**. Suggestions stay free; full itineraries need Full access.

- **Entry points**: an offer card at the top of the signed-in homepage ("Get full access for €10/month"), and a locked "Get full itinerary" button on each suggestion. Both go to `/subscribe`, an order-summary page, which starts Stripe-hosted Checkout (`mode: subscription`). Cancelling Checkout returns the user to where they started.
- **Customer**: one Stripe Customer per user, created at first checkout and stored on `User.stripeCustomerId`, so Checkout, the portal and every later subscription share it.
- **Access = Stripe Entitlements.** A Stripe Feature (`full-access`) is attached to the product. Stripe grants and revokes it as the subscription starts, lapses or is cancelled, and fires `entitlements.active_entitlement_summary.updated`. The webhook writes the summary into `Entitlement`; `hasFullAccess()` reads that. Because access follows entitlements rather than `checkout.session.completed`, a delayed payment method doesn't get access before it's paid (the guide's caveat). Summaries carry the event time and older ones are ignored, so late deliveries can't flip access.
- **Subscription mirror**: `Subscription` holds status, renewal date and cancel-at-period-end for the account page and a failed-payment banner. It's re-fetched from Stripe on every subscription/invoice/checkout webhook.
- **Return from Checkout**: `/billing/success` syncs immediately (best effort) so access is usually live on landing; otherwise it shows "Confirming your payment…" until the webhooks arrive.
- **Management**: `/account` shows plan state and opens the Stripe customer portal (update card, invoices, cancel). `invoice.payment_failed` → subscription goes `past_due` → homepage banner and account page point to the portal to update the card.
- **Gate**: `generateItineraryForSuggestion` checks `hasFullAccess()` server-side and redirects to `/subscribe` otherwise. Itineraries generated while subscribed stay viewable after cancelling.
- Webhook: `src/app/api/stripe/webhook/route.ts` (public in `src/proxy.ts`, authenticated by Stripe signature).

## 7. Phased Build Order

1. Scaffold Next.js + Prisma + Postgres + Auth.js magic-link login. ✅
2. Household/kid onboarding forms + data model. ✅
3. Past-trip capture + taste-profile extraction (with edit-before-save step). ✅
4. Suggestion generation (LLM only, no pricing API yet) + shortlist UI. ✅
5. Itinerary deep-dive generation + UI. ✅
6. Save/shortlist persistence + `/saved` page. ✅
7. Amadeus flight-pricing integration layered into suggestion cost bands. ✅
8. Mobile-responsive pass across all pages. ✅ (verified at 375px against seeded data - see PR/session notes)
9. Stripe subscription (Full access, €10/month) wired to the itinerary gate. ✅

## 8. Open Items for Build Time

- Exact Claude model choice per call (extraction/suggestions can use a smaller/faster model; itinerary generation may warrant the stronger one).
- Amadeus sandbox vs. production credentials and rate limits.
- Whether taste-profile edit step (§4.1) is required-before-save or skippable.
