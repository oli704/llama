"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { generateSuggestions } from "@/lib/llm/generateSuggestions";
import { generateItinerary } from "@/lib/llm/generateItinerary";
import { lookupFlightPrice } from "@/lib/amadeus";
import type { HouseholdInput, SuggestionLLM, TasteProfile } from "@/lib/llm/types";

export async function createSuggestionSet(formData: FormData) {
  const userId = await requireUserId();

  const tripIds = formData.getAll("tripIds").map(String);
  if (tripIds.length === 0) {
    throw new Error("Select at least one past trip to base suggestions on.");
  }

  const [trips, household] = await Promise.all([
    prisma.pastTrip.findMany({
      where: { id: { in: tripIds }, userId },
    }),
    prisma.household.findUnique({
      where: { userId },
      include: { kids: true },
    }),
  ]);

  if (!household || household.kids.length === 0) {
    throw new Error("Add your household and at least one kid before generating suggestions.");
  }
  if (!household.homeBase.trim()) {
    throw new Error("Set your home base before generating suggestions.");
  }

  const tasteProfiles = trips
    .map((t) => t.tasteProfile as unknown as TasteProfile | null)
    .filter((p): p is TasteProfile => p != null);

  if (tasteProfiles.length === 0) {
    throw new Error("Selected trips don't have an extracted taste profile yet.");
  }

  const householdInput: HouseholdInput = {
    homeBase: household.homeBase,
    budgetMin: household.budgetMin,
    budgetMax: household.budgetMax,
    budgetCurrency: household.budgetCurrency,
    tripLengthMaxDays: household.tripLengthMaxDays,
    mustAvoids: household.mustAvoids,
    kids: household.kids.map((k) => ({ label: k.label, ageBand: k.ageBand })),
  };

  const suggestions = await generateSuggestions({ tasteProfiles, household: householdInput });

  // Best-effort live flight price per suggestion - never blocks suggestion creation.
  const flightPrices = await Promise.all(
    suggestions.map((s) =>
      lookupFlightPrice({
        homeBase: household.homeBase,
        destinationIata: s.nearestAirportIata,
        tripLengthDays: s.estTripLengthDays,
        kids: household.kids,
      }).catch(() => null)
    )
  );

  const set = await prisma.suggestionSet.create({
    data: {
      userId,
      inputSnapshot: { tasteProfiles, household: householdInput } as unknown as object,
      suggestions: {
        create: suggestions.map((s, i) => ({
          rank: i + 1,
          destinationName: s.destinationName,
          rationale: s.rationale,
          estCostMin: s.estCostMin,
          estCostMax: s.estCostMax,
          costCurrency: s.costCurrency,
          estTripLengthDays: s.estTripLengthDays,
          kidRiskNotes: s.kidRiskNotes as unknown as object,
          flightPriceAmount: flightPrices[i]?.amount ?? null,
          flightPriceCurrency: flightPrices[i]?.currency ?? null,
          flightPriceCheckedAt: flightPrices[i] ? new Date() : null,
        })),
      },
    },
  });

  redirect(`/suggestions/${set.id}`);
}

export async function generateItineraryForSuggestion(suggestionId: string) {
  const userId = await requireUserId();

  const suggestion = await prisma.suggestion.findUnique({
    where: { id: suggestionId },
    include: { suggestionSet: true },
  });
  if (!suggestion || suggestion.suggestionSet.userId !== userId) {
    throw new Error("Not found");
  }

  const household = await prisma.household.findUnique({
    where: { userId },
    include: { kids: true },
  });
  if (!household) throw new Error("Household not set up");

  const householdInput: HouseholdInput = {
    homeBase: household.homeBase,
    budgetMin: household.budgetMin,
    budgetMax: household.budgetMax,
    budgetCurrency: household.budgetCurrency,
    tripLengthMaxDays: household.tripLengthMaxDays,
    mustAvoids: household.mustAvoids,
    kids: household.kids.map((k) => ({ label: k.label, ageBand: k.ageBand })),
  };

  const suggestionInput: SuggestionLLM = {
    destinationName: suggestion.destinationName,
    rationale: suggestion.rationale,
    estCostMin: suggestion.estCostMin ?? 0,
    estCostMax: suggestion.estCostMax ?? 0,
    costCurrency: suggestion.costCurrency ?? household.budgetCurrency ?? "",
    estTripLengthDays: suggestion.estTripLengthDays ?? household.tripLengthMaxDays,
    kidRiskNotes: suggestion.kidRiskNotes as unknown as Record<string, string>,
    // Not persisted on Suggestion (only used for the flight-price lookup at creation time)
    // and not needed by itinerary generation.
    nearestAirportIata: null,
  };

  const days = await generateItinerary({ suggestion: suggestionInput, household: householdInput });

  await prisma.itinerary.upsert({
    where: { suggestionId },
    create: { suggestionId, days: days as unknown as object },
    update: { days: days as unknown as object },
  });

  revalidatePath(`/suggestions/${suggestion.suggestionSetId}`);
}

export async function toggleSaveSuggestion(suggestionId: string) {
  const userId = await requireUserId();

  const suggestion = await prisma.suggestion.findUnique({
    where: { id: suggestionId },
    include: { suggestionSet: true },
  });
  if (!suggestion || suggestion.suggestionSet.userId !== userId) {
    throw new Error("Not found");
  }

  await prisma.suggestion.update({
    where: { id: suggestionId },
    data: { saved: !suggestion.saved },
  });

  revalidatePath(`/suggestions/${suggestion.suggestionSetId}`);
  revalidatePath("/saved");
}
