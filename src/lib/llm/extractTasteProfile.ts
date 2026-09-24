import { callStructured, MODEL_FAST } from "@/lib/anthropic";
import type { TasteProfile } from "./types";

export async function extractTasteProfile(rawText: string): Promise<TasteProfile> {
  return callStructured<TasteProfile>({
    model: MODEL_FAST,
    system:
      "You extract a structured 'taste profile' from a parent's free-text description of a trip they took before having kids. Be concrete and specific - avoid generic filler. Base every field only on what the text actually says or strongly implies.",
    prompt: `Here is the trip description:\n\n"""\n${rawText}\n"""\n\nExtract its taste profile.`,
    toolName: "record_taste_profile",
    toolDescription: "Records the structured taste profile extracted from the trip description.",
    inputSchema: {
      properties: {
        destinationType: {
          type: "string",
          description: "e.g. 'coastal town', 'major city', 'rural/mountain', 'island'",
        },
        pace: {
          type: "string",
          description: "e.g. 'slow and unstructured', 'packed and active', 'a mix'",
        },
        activityMix: {
          type: "array",
          items: { type: "string" },
          description: "Specific activity types present, e.g. 'hiking', 'markets', 'nightlife', 'museums'",
        },
        socialVsSolitary: {
          type: "string",
          description: "e.g. 'social/crowded', 'quiet/solitary', 'mixed'",
        },
        budgetTier: {
          type: "string",
          description: "e.g. 'budget/backpacker', 'mid-range', 'splurge'",
        },
        climate: {
          type: "string",
          description: "e.g. 'hot and dry', 'cold', 'temperate', 'tropical'",
        },
        whatMadeItSpecial: {
          type: "string",
          description: "One or two sentences on the emotional/experiential core - why this trip stuck with them.",
        },
      },
      required: [
        "destinationType",
        "pace",
        "activityMix",
        "socialVsSolitary",
        "budgetTier",
        "climate",
        "whatMadeItSpecial",
      ],
    },
  });
}
