// Amadeus Self-Service integration (test/sandbox environment): resolves a free-text
// home base to an IATA code, then looks up an indicative flight price. Best-effort
// throughout - any failure (missing creds, no route found, rate limit, sandbox
// coverage gaps, unresolvable city) should degrade to "no live price" rather than
// break suggestion generation, which otherwise runs entirely on LLM knowledge.

const AMADEUS_BASE_URL = "https://test.api.amadeus.com";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 10_000) {
    return cachedToken.value;
  }

  const res = await fetch(`${AMADEUS_BASE_URL}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

// In-memory cache so repeated suggestion runs from the same home base (or the same
// LLM-guessed destination) don't re-hit the location-search endpoint every time.
const iataCache = new Map<string, string | null>();

/**
 * Resolves free text (a home base like "Austin, Texas" or a destination name like
 * "Kyoto") to the nearest major city/airport IATA code, via Amadeus's location search.
 * Prefers a CITY-subtype result (covers multi-airport metros) over a single AIRPORT.
 * Returns null if unresolvable, uncredentialed, or the API call fails.
 */
export async function resolveIata(freeText: string): Promise<string | null> {
  const key = freeText.trim().toLowerCase();
  if (!key) return null;
  if (iataCache.has(key)) return iataCache.get(key)!;

  const token = await getAccessToken();
  if (!token) return null;

  try {
    const params = new URLSearchParams({
      subType: "CITY,AIRPORT",
      keyword: freeText.trim(),
      "page[limit]": "5",
    });
    const res = await fetch(`${AMADEUS_BASE_URL}/v1/reference-data/locations?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      iataCache.set(key, null);
      return null;
    }

    const data = (await res.json()) as {
      data?: { subType: string; iataCode: string }[];
    };
    const results = data.data ?? [];
    const best = results.find((r) => r.subType === "CITY") ?? results[0];
    const iata = best?.iataCode ?? null;

    iataCache.set(key, iata);
    return iata;
  } catch {
    iataCache.set(key, null);
    return null;
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type FlightPrice = { amount: number; currency: string };

/**
 * Looks up an indicative round-trip fare for a family (2 adults, kids mapped to
 * Amadeus's children/infants categories) roughly 6 weeks out. Returns null on any
 * failure or when there isn't enough information to search (home base or destination
 * doesn't resolve to an IATA code, no API credentials configured).
 */
export async function lookupFlightPrice(args: {
  homeBase: string;
  destinationIata: string | null;
  tripLengthDays: number;
  kids: { ageBand: "BABY" | "TODDLER" | "PRESCHOOLER" }[];
}): Promise<FlightPrice | null> {
  if (!args.destinationIata) return null;

  const [origin, token] = await Promise.all([resolveIata(args.homeBase), getAccessToken()]);
  if (!origin || !token) return null;

  const departureDate = addDays(new Date(), 42);
  const returnDate = addDays(departureDate, args.tripLengthDays);

  // Amadeus: infants < 2, children 2-11. BABY (0-1) -> infant; TODDLER/PRESCHOOLER -> child.
  const infants = args.kids.filter((k) => k.ageBand === "BABY").length;
  const children = args.kids.filter((k) => k.ageBand !== "BABY").length;

  const params = new URLSearchParams({
    originLocationCode: origin,
    destinationLocationCode: args.destinationIata,
    departureDate: isoDate(departureDate),
    returnDate: isoDate(returnDate),
    adults: "2",
    max: "5",
  });
  if (children > 0) params.set("children", String(children));
  if (infants > 0) params.set("infants", String(Math.min(infants, 2))); // Amadeus caps infants <= adults

  try {
    const res = await fetch(`${AMADEUS_BASE_URL}/v2/shopping/flight-offers?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      data?: { price: { grandTotal: string; currency: string } }[];
    };
    const cheapest = data.data?.[0];
    if (!cheapest) return null;

    return { amount: Number(cheapest.price.grandTotal), currency: cheapest.price.currency };
  } catch {
    return null;
  }
}
