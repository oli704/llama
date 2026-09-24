import { callStructured, MODEL_SMART } from "@/lib/anthropic";
import type { HouseholdInput, SuggestionLLM, TasteProfile } from "./types";

const AGE_BAND_LABEL: Record<string, string> = {
  BABY: "baby (0-1)",
  TODDLER: "toddler (1-3)",
  PRESCHOOLER: "preschooler (3-5)",
};

export async function generateSuggestions(input: {
  tasteProfiles: TasteProfile[];
  household: HouseholdInput;
}): Promise<SuggestionLLM[]> {
  const { tasteProfiles, household } = input;

  const ageBands = [...new Set(household.kids.map((k) => k.ageBand))];
  const currencyHint = household.budgetCurrency ?? "whichever currency is standard for the home base";
  const budgetLine =
    household.budgetMin != null && household.budgetMax != null
      ? `${household.budgetMin}-${household.budgetMax} ${currencyHint} total for the trip`
      : `no fixed budget stated (use ${currencyHint} for cost estimates)`;

  const prompt = `A parent based in ${household.homeBase} wants a kid-friendly trip that recreates the feeling of trips they used to take before having kids.

Their past trip(s), as extracted taste profiles:
${tasteProfiles
  .map(
    (p, i) => `Trip ${i + 1}: ${p.destinationType}, pace: ${p.pace}, activities: ${p.activityMix.join(", ")}, ${p.socialVsSolitary}, budget: ${p.budgetTier}, climate: ${p.climate}. What made it special: ${p.whatMadeItSpecial}`
  )
  .join("\n")}

Household constraints:
- Home base: ${household.homeBase}
- Budget: ${budgetLine}
- Max trip length: ${household.tripLengthMaxDays} days
- Kids: ${household.kids.map((k) => `${k.label} (${AGE_BAND_LABEL[k.ageBand]})`).join(", ")}
- Must-avoid: ${household.mustAvoids ?? "none stated"}

Suggest 5 named, real, currently-viable destinations/trips reachable within the trip length and budget from the home base. Rank them best-fit first. For each, explain in one or two sentences how it recreates what made their past trip(s) special, adapted for young kids. Give a realistic total cost estimate band in ${currencyHint} (state the 3-letter currency code you used), an estimated trip length in days, a short kid-logistics/risk note (covering things like nap disruption, flight/transit tolerance, stroller access, food options) for each age band present in the household: ${ageBands.map((b) => AGE_BAND_LABEL[b]).join(", ")}, and the IATA code of the nearest major airport to the destination (or null if the trip doesn't need a flight, e.g. reachable by car or train from the home base).`;

  const result = await callStructured<{ suggestions: SuggestionLLM[] }>({
    model: MODEL_SMART,
    system:
      "You are a travel planner specializing in adapting adults' pre-kid travel style into genuinely kid-friendly trips for parents of children under 5. You suggest real, named destinations - never invented places - and you're specific and practical about the logistics of traveling with a baby, toddler, or preschooler.",
    prompt,
    toolName: "record_suggestions",
    toolDescription: "Records the ranked list of trip suggestions.",
    inputSchema: {
      properties: {
        suggestions: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              destinationName: { type: "string" },
              rationale: {
                type: "string",
                description: "Ties back to what made the past trip special, adapted for kids.",
              },
              estCostMin: { type: "integer", description: "Whole trip, low end, in costCurrency" },
              estCostMax: { type: "integer", description: "Whole trip, high end, in costCurrency" },
              costCurrency: {
                type: "string",
                description: "3-letter currency code for estCostMin/estCostMax, e.g. USD, EUR, GBP, JPY.",
              },
              estTripLengthDays: { type: "integer" },
              kidRiskNotes: {
                type: "object",
                description: "Keyed by age band (BABY/TODDLER/PRESCHOOLER) present in the household, value is a short logistics/risk note.",
                additionalProperties: { type: "string" },
              },
              nearestAirportIata: {
                type: ["string", "null"],
                description: "3-letter IATA airport code nearest the destination, or null if no flight is needed.",
              },
            },
            required: [
              "destinationName",
              "rationale",
              "estCostMin",
              "estCostMax",
              "costCurrency",
              "estTripLengthDays",
              "kidRiskNotes",
              "nearestAirportIata",
            ],
          },
        },
      },
      required: ["suggestions"],
    },
  });

  return result.suggestions;
}
