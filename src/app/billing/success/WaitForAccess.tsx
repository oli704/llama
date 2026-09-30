"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const POLL_MS = 2000;
const GIVE_UP_MS = 30000;

// Shown while Stripe is still granting access after Checkout. Re-renders the page
// every couple of seconds (which re-syncs from Stripe) until access shows up, then
// the server swaps this out for the "You're in" state.
export function WaitForAccess() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > GIVE_UP_MS) {
        clearInterval(id);
        setTimedOut(true);
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [router]);

  if (timedOut) {
    return (
      <p className="text-sm text-neutral-700">
        This is taking longer than usual. Your payment is safe - refresh this page in a minute,
        or check your{" "}
        <Link href="/account" className="underline">
          account
        </Link>
        .
      </p>
    );
  }

  return (
    <p className="flex items-center gap-3 text-sm text-neutral-700" role="status">
      <span
        aria-hidden
        className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-emerald-700"
      />
      Stripe is confirming your payment. This usually takes a few seconds.
    </p>
  );
}
