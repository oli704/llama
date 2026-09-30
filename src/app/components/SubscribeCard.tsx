import Link from "next/link";
import { PLAN } from "@/lib/billing";

export function SubscribeCard({ returnTo }: { returnTo: string }) {
  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Get full access for {PLAN.priceLabel}</h2>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            {PLAN.features.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
        </div>
        <Link
          href={`/subscribe?returnTo=${encodeURIComponent(returnTo)}`}
          className="whitespace-nowrap rounded bg-emerald-700 px-4 py-2 text-sm text-white"
        >
          Get full access
        </Link>
      </div>
    </div>
  );
}
