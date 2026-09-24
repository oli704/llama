export type AgeBand = "BABY" | "TODDLER" | "PRESCHOOLER";

export type TasteProfile = {
  destinationType: string;
  pace: string;
  activityMix: string[];
  socialVsSolitary: string;
  budgetTier: string;
  climate: string;
  whatMadeItSpecial: string;
};

export type HouseholdInput = {
  homeBase: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string | null;
  tripLengthMaxDays: number;
  mustAvoids: string | null;
  kids: { label: string; ageBand: AgeBand }[];
};

export type SuggestionLLM = {
  destinationName: string;
  rationale: string;
  estCostMin: number;
  estCostMax: number;
  // 3-letter currency code most natural for someone based at the household's home base.
  costCurrency: string;
  estTripLengthDays: number;
  kidRiskNotes: Record<string, string>;
  // Nearest major airport IATA code for a live flight-price lookup, or null when the
  // trip doesn't hinge on a flight (e.g. reachable by car/train from the home base).
  nearestAirportIata: string | null;
};

export type ItineraryDay = {
  day: number;
  title: string;
  activities: string[];
  kidNotes: string[];
};
