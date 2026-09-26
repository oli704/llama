import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { stripe } from "@/lib/stripe";
import { PLAN, hasFullAccess, idOf, syncEntitlements, syncSubscription } from "@/lib/billing";

export default async function CheckoutSuccessPage({ searchParams }: PageProps<"/billing/success">) {
  const userId = await requireUserId();
  const { session_id } = await searchParams;

  let returnTo = "/";
  if (typeof session_id === "string" && session_id.startsWith("cs_")) {
    // Sync now rather than waiting on the webhooks, so access is live the moment they
    // land here if Stripe has already granted it. The webhooks do the same sync, so
    // whichever runs first wins harmlessly. Best effort only: on any failure the
    // webhooks catch up and the page shows "confirming".
    try {
      const session = await stripe().checkout.sessions.retrieve(session_id);
      if (session.client_reference_id === userId && session.subscription && session.customer) {
        returnTo = session.metadata?.returnTo ?? "/";
        await syncSubscription(idOf(session.subscription));
        await syncEntitlements(idOf(session.customer));
      }
    } catch (err) {
      console.error("Post-checkout sync failed", err);
    }
  }

  const active = await hasFullAccess(userId);

  return (
    <div className="mx-auto max-w-md space-y-4 rounded border border-neutral-200 bg-white p-6">
      {active ? (
        <>
          <h1 className="text-xl font-semibold">You&apos;re in 🎉</h1>
          <p className="text-sm text-neutral-700">
            {PLAN.name} is active. Every suggestion now comes with a full day-by-day itinerary.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold">Confirming your payment…</h1>
          <p className="text-sm text-neutral-700">
            Stripe is still processing this. It usually takes a few seconds - refresh this page,
            or check your <Link href="/account" className="underline">account</Link>.
          </p>
        </>
      )}
      <Link href={returnTo} className="inline-block rounded bg-neutral-900 px-4 py-2 text-sm text-white">
        {returnTo === "/" ? "Back to Llama" : "Back to where you were"}
      </Link>
    </div>
  );
}
