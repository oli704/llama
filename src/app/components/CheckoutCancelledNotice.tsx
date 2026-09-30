"use client";

import { useSearchParams } from "next/navigation";

// Stripe Checkout's cancel URL adds ?checkout=cancelled (see startCheckout), so
// backing out of payment says so instead of silently dropping them back.
export function CheckoutCancelledNotice() {
  const cancelled = useSearchParams().get("checkout") === "cancelled";
  if (!cancelled) return null;
  return (
    <p role="status" className="mb-6 rounded border border-neutral-200 bg-white p-3 text-sm text-neutral-700">
      Checkout cancelled - you haven&apos;t been charged. You can get Full access any time.
    </p>
  );
}
