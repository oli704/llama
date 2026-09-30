import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { createSuggestionSet } from "@/app/actions/suggestions";
import { PendingButton } from "@/app/components/PendingButton";
import type { TasteProfile } from "@/lib/llm/types";

export const metadata = { title: "New suggestions" };

export default async function NewSuggestionsPage() {
  const userId = await requireUserId();
  const [trips, household] = await Promise.all([
    prisma.pastTrip.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    prisma.household.findUnique({ where: { userId }, include: { kids: true } }),
  ]);

  const readyTrips = trips.filter((t) => t.tasteProfile != null);

  if (!household || household.kids.length === 0 || !household.homeBase.trim()) {
    return (
      <EmptyState
        title="First, tell us about your family"
        body="We need your home base and your kids' ages to suggest trips that work for you."
        href="/household"
        action="Set up your household"
      />
    );
  }

  if (readyTrips.length === 0) {
    return (
      <EmptyState
        title="Tell us about a trip you loved"
        body="Suggestions are built from a trip you took before kids - add one to get started."
        href="/trips"
        action="Add a past trip"
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Which past trip(s) should we draw from?</h1>
      <form action={createSuggestionSet} className="space-y-4">
        <ul className="space-y-2">
          {readyTrips.map((trip, i) => {
            const profile = trip.tasteProfile as unknown as TasteProfile;
            return (
              <li key={trip.id} className="rounded border border-neutral-200 bg-white p-4">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name="tripIds"
                    value={trip.id}
                    defaultChecked={i === 0}
                    className="mt-1"
                  />
                  <span className="text-sm">
                    <span className="font-medium">{profile.destinationType}</span> - {trip.rawText.slice(0, 140)}
                    {trip.rawText.length > 140 ? "…" : ""}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <PendingButton
          className="rounded bg-neutral-900 px-4 py-2 text-white"
          pendingLabel="Finding destinations… (this can take up to a minute)"
        >
          Generate suggestions
        </PendingButton>
      </form>
    </div>
  );
}

function EmptyState({ title, body, href, action }: { title: string; body: string; href: string; action: string }) {
  return (
    <div className="mx-auto max-w-md space-y-3 rounded border border-neutral-200 bg-white p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-neutral-600">{body}</p>
      <Link href={href} className="inline-block rounded bg-neutral-900 px-4 py-2 text-sm text-white">
        {action} →
      </Link>
    </div>
  );
}
