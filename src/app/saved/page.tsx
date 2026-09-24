import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function SavedPage() {
  const userId = await requireUserId();

  const saved = await prisma.suggestion.findMany({
    where: { saved: true, suggestionSet: { userId } },
    include: { suggestionSet: true, itinerary: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Saved trips</h1>
      <ul className="space-y-2">
        {saved.map((s) => (
          <li key={s.id} className="rounded border border-neutral-200 bg-white p-4">
            <Link href={`/suggestions/${s.suggestionSetId}`} className="font-medium underline">
              {s.destinationName}
            </Link>
            <p className="mt-1 text-sm text-neutral-600">{s.rationale}</p>
            <p className="mt-1 text-xs text-neutral-400">
              {s.itinerary ? "Full itinerary generated" : "Shortlist only"}
            </p>
          </li>
        ))}
        {!saved.length && <p className="text-sm text-neutral-500">Nothing saved yet.</p>}
      </ul>
    </div>
  );
}
