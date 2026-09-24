import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createSuggestionSet } from "@/app/actions/suggestions";
import type { TasteProfile } from "@/lib/llm/types";

export default async function NewSuggestionsPage() {
  const userId = await requireUserId();
  const [trips, household] = await Promise.all([
    prisma.pastTrip.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.household.findUnique({ where: { userId }, include: { kids: true } }),
  ]);

  const readyTrips = trips.filter((t) => t.tasteProfile != null);

  if (!household || household.kids.length === 0 || !household.homeBase.trim()) {
    return (
      <p className="text-sm">
        Set up your <Link href="/household" className="underline">household, home base, and kids</Link> first.
      </p>
    );
  }

  if (readyTrips.length === 0) {
    return (
      <p className="text-sm">
        Add at least one <Link href="/trips" className="underline">past trip</Link> first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Which past trip(s) should we draw from?</h1>
      <form action={createSuggestionSet} className="space-y-4">
        <ul className="space-y-2">
          {readyTrips.map((trip) => {
            const profile = trip.tasteProfile as unknown as TasteProfile;
            return (
              <li key={trip.id} className="rounded border border-neutral-200 bg-white p-4">
                <label className="flex items-start gap-3">
                  <input type="checkbox" name="tripIds" value={trip.id} className="mt-1" />
                  <span className="text-sm">
                    <span className="font-medium">{profile.destinationType}</span> - {trip.rawText.slice(0, 140)}
                    {trip.rawText.length > 140 ? "…" : ""}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-white">
          Generate suggestions
        </button>
      </form>
    </div>
  );
}
