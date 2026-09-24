import { callStructured, MODEL_SMART } from "@/lib/anthropic";
import type { HouseholdInput, ItineraryDay, SuggestionLLM } from "./types";

const AGE_BAND_LABEL: Record<string, string> = {
  BABY: "baby (0-1)",
  TODDLER: "toddler (1-3)",
  PRESCHOOLER: "preschooler (3-5)",
};

export async function generateItinerary(input: {
  suggestion: SuggestionLLM;
  household: HouseholdInput;
}): Promise<ItineraryDay[]> {
  const { suggestion, household } = input;

  const prompt = `Build a full day-by-day itinerary for this trip:

Destination/trip: ${suggestion.destinationName}
Why it was suggested: ${suggestion.rationale}
Trip length: ${suggestion.estTripLengthDays} days
Household: kids are ${household.kids
    .map((k) => `${k.label} (${AGE_BAND_LABEL[k.ageBand]})`)
    .join(", ")}, traveling from ${household.homeBase}.

For each day, give a short title, a small list of activities paced appropriately for the youngest child in the household (respect nap windows, avoid overly long transit or activity blocks, build in downtime), and specific kid-logistics notes for that day (e.g. stroller access, meal timing, nap-friendly windows).`;

  const result = await callStructured<{ days: ItineraryDay[] }>({
    model: MODEL_SMART,
    system:
      "You are a travel planner building realistic, specific day-by-day itineraries for families with children under 5. You pace days around nap schedules and short attention spans rather than adult-pace sightseeing.",
    prompt,
    toolName: "record_itinerary",
    toolDescription: "Records the day-by-day itinerary.",
    inputSchema: {
      properties: {
        days: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "integer" },
              title: { type: "string" },
              activities: { type: "array", items: { type: "string" } },
              kidNotes: { type: "array", items: { type: "string" } },
            },
            required: ["day", "title", "activities", "kidNotes"],
          },
        },
      },
      required: ["days"],
    },
  });

  return result.days;
}
