import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { isGuestEmail } from "@/lib/guest";
import { PLAN, hasLiveSubscription, syncSubscription } from "@/lib/billing";
import { openBillingPortal } from "@/app/actions/billing";
import { SubscribeCard } from "@/app/components/SubscribeCard";
import { PendingButton } from "@/app/components/PendingButton";

export const metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const userId = await requireUserId();
  const { from, already } = await searchParams;

  // Back from the Stripe billing portal: re-read the subscription so a cancellation
  // (or resume) shows now rather than when its webhook lands. Best effort.
  if (from === "portal") {
    const current = await prisma.subscription.findUnique({ where: { userId } });
    if (current) {
      await syncSubscription(current.stripeSubscriptionId).catch((err) =>
        console.error("Post-portal subscription sync failed", err),
      );
    }
  }

  const [user, live] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { subscription: true } }),
    hasLiveSubscription(userId),
  ]);
  const sub = user.subscription;
  const periodEnd = sub?.currentPeriodEnd.toLocaleDateString("en-GB", { dateStyle: "long" });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Account</h1>
      {already === "1" && live && (
        <p role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          You already have {PLAN.name} - nothing more to pay.
        </p>
      )}
      <p className="text-sm text-neutral-600">
        {isGuestEmail(user.email) ? (
          <>
            You&apos;re using Llama as a guest - your trips are kept in this browser.{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>{" "}
            to use an email account instead.
          </>
        ) : (
          <>Signed in as {user.email}</>
        )}
      </p>

      {live && sub ? (
        <div className="space-y-3 rounded border border-neutral-200 bg-white p-4 sm:p-5">
          <h2 className="font-semibold">
            {PLAN.name} · {PLAN.priceLabel}
          </h2>
          {sub.status === "past_due" ? (
            <p className="text-sm text-amber-700">
              Your last payment failed. Update your payment method to keep full access - Stripe
              will retry automatically.
            </p>
          ) : sub.cancelAtPeriodEnd ? (
            <p className="text-sm text-neutral-700">Cancelled - you keep access until {periodEnd}.</p>
          ) : (
            <p className="text-sm text-neutral-700">Renews on {periodEnd}.</p>
          )}
          <form action={openBillingPortal}>
            <PendingButton
              className="rounded border border-neutral-300 px-3 py-1 text-sm"
              pendingLabel="Opening…"
            >
              {sub.status === "past_due" ? "Update payment method" : "Manage subscription"}
            </PendingButton>
          </form>
          <p className="text-xs text-neutral-500">
            Update your card, download invoices, or cancel - handled securely by Stripe.
          </p>
        </div>
      ) : (
        <>
          <SubscribeCard returnTo="/account" />
          {user.stripeCustomerId && (
            <form action={openBillingPortal}>
              <button type="submit" className="text-sm underline">
                View past invoices
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
