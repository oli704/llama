import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { generateItineraryForSuggestion, toggleSaveSuggestion } from "@/app/actions/suggestions";
import { PLAN, hasFullAccess } from "@/lib/billing";
import { PendingButton } from "@/app/components/PendingButton";
import type { ItineraryDay } from "@/lib/llm/types";

export default async function SuggestionSetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const set = await prisma.suggestionSet.findUnique({
    where: { id },
    include: { suggestions: { include: { itinerary: true }, orderBy: { rank: "asc" } } },
  });

  if (!set || set.userId !== userId) notFound();

  const fullAccess = await hasFullAccess(userId);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Your suggestions</h1>
      <div className="space-y-4">
        {set.suggestions.map((s) => {
          const days = s.itinerary?.days as unknown as ItineraryDay[] | undefined;
          return (
            <div key={s.id} className="rounded border border-neutral-200 bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    #{s.rank} {s.destinationName}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-700">{s.rationale}</p>
                </div>
                <form action={toggleSaveSuggestion.bind(null, s.id)}>
                  <button
                    type="submit"
                    className={`whitespace-nowrap rounded px-3 py-1 text-sm ${
                      s.saved ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {s.saved ? "★ Saved" : "☆ Save"}
                  </button>
                </form>
              </div>

              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-neutral-600">
                <div>
                  <dt className="inline font-medium">Est. cost:</dt>{" "}
                  <dd className="inline">
                    {s.costCurrency ?? ""} {s.estCostMin}-{s.estCostMax}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium">Trip length:</dt>{" "}
                  <dd className="inline">{s.estTripLengthDays} days</dd>
                </div>
                {s.flightPriceAmount != null && (
                  <div>
                    <dt className="inline font-medium text-emerald-700">Live flight price:</dt>{" "}
                    <dd className="inline text-emerald-700">
                      {s.flightPriceCurrency} {s.flightPriceAmount.toFixed(0)} (2 adults, via Amadeus)
                    </dd>
                  </div>
                )}
              </dl>

              <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                {Object.entries(s.kidRiskNotes as Record<string, string>).map(([band, note]) => (
                  <li key={band}>
                    <span className="font-medium">{band}:</span> {note}
                  </li>
                ))}
              </ul>

              {days ? (
                <div className="mt-4 space-y-3 border-t border-neutral-100 pt-4">
                  {days.map((day) => (
                    <div key={day.day}>
                      <h3 className="text-sm font-semibold">
                        Day {day.day}: {day.title}
                      </h3>
                      <ul className="ml-4 list-disc text-xs text-neutral-700">
                        {day.activities.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                      {day.kidNotes.length > 0 && (
                        <ul className="ml-4 list-disc text-xs text-amber-700">
                          {day.kidNotes.map((n, i) => (
                            <li key={i}>{n}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : fullAccess ? (
                <form action={generateItineraryForSuggestion.bind(null, s.id)} className="mt-4">
                  <PendingButton
                    className="rounded border border-neutral-300 px-3 py-1 text-sm"
                    pendingLabel="Planning your days… (this can take a minute)"
                  >
                    Get full itinerary
                  </PendingButton>
                </form>
              ) : (
                <Link
                  href={`/subscribe?returnTo=${encodeURIComponent(`/suggestions/${set.id}`)}`}
                  className="mt-4 inline-block rounded border border-emerald-300 bg-emerald-50 px-3 py-1 text-sm text-emerald-800"
                >
                  🔒 Get full itinerary · {PLAN.name} {PLAN.priceLabel}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
