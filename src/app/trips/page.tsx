import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { addPastTrip, deletePastTrip } from "@/app/actions/trips";
import type { TasteProfile } from "@/lib/llm/types";

export default async function TripsPage() {
  const userId = await requireUserId();
  const trips = await prisma.pastTrip.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold">Past trips</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Tell us about a trip you took before kids - what it was, and why you loved it.
        </p>
        <form action={addPastTrip} className="mt-4 space-y-3 rounded border border-neutral-200 bg-white p-4">
          <textarea
            name="rawText"
            required
            rows={5}
            placeholder="e.g. We spent two weeks backpacking through Vietnam, eating street food and getting lost in Hanoi's old quarter. It was chaotic and cheap and we loved having no plan..."
            className="w-full rounded border border-neutral-300 px-3 py-2"
          />
          <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-white">
            Add trip
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {trips.map((trip) => {
          const profile = trip.tasteProfile as unknown as TasteProfile | null;
          return (
            <div key={trip.id} className="rounded border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <p className="min-w-0 flex-1 text-sm text-neutral-700">{trip.rawText}</p>
                <form action={deletePastTrip.bind(null, trip.id)}>
                  <button type="submit" className="whitespace-nowrap text-sm text-red-600">
                    Delete
                  </button>
                </form>
              </div>
              {profile ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-600 sm:grid-cols-3">
                  <div><dt className="font-medium">Destination type</dt><dd>{profile.destinationType}</dd></div>
                  <div><dt className="font-medium">Pace</dt><dd>{profile.pace}</dd></div>
                  <div><dt className="font-medium">Activities</dt><dd>{profile.activityMix.join(", ")}</dd></div>
                  <div><dt className="font-medium">Social</dt><dd>{profile.socialVsSolitary}</dd></div>
                  <div><dt className="font-medium">Budget tier</dt><dd>{profile.budgetTier}</dd></div>
                  <div><dt className="font-medium">Climate</dt><dd>{profile.climate}</dd></div>
                  <div className="col-span-2 sm:col-span-3">
                    <dt className="font-medium">What made it special</dt>
                    <dd>{profile.whatMadeItSpecial}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-xs text-amber-600">Extracting taste profile...</p>
              )}
            </div>
          );
        })}
        {!trips.length && <p className="text-sm text-neutral-500">No past trips added yet.</p>}
      </section>
    </div>
  );
}
