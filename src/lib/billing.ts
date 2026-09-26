// Subscription billing, following Stripe's "Sell subscriptions as a SaaS startup"
// guide: one flat-rate "Full access" plan sold via Stripe-hosted Checkout, managed
// via the Stripe customer portal, and provisioned via Stripe Entitlements.
//
// Stripe is the source of truth. We mirror two things locally so page loads don't
// need Stripe API calls:
//   - Entitlement rows: which Stripe Features the customer currently has (access).
//   - Subscription row: status / renewal date / cancellation (account page display).
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Display copy only - the amount actually charged is whatever STRIPE_PRICE_ID is set
// to in Stripe. Keep the two in step.
export const PLAN = {
  name: "Full access",
  priceLabel: "€10/month",
  features: [
    "Unlimited day-by-day itineraries for any suggestion",
    "Kid-specific pacing notes: nap windows, transit limits",
    "Cancel any time from your account page",
  ],
};

// lookup_key of the Stripe Feature attached to the Full access product. Stripe grants
// it while the subscription is active and revokes it when the subscription ends.
export const FULL_ACCESS_FEATURE = "full-access";

// Subscription statuses that count as a live subscription (for display and to stop
// someone buying a second one). Access itself is decided by entitlements.
const LIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function hasFullAccess(userId: string): Promise<boolean> {
  const entitlement = await prisma.entitlement.findUnique({
    where: { userId_type: { userId, type: FULL_ACCESS_FEATURE } },
  });
  return !!entitlement;
}

export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe().customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId },
  });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

async function userForCustomer(customerId: string, metadataUserId?: string) {
  return (
    (await prisma.user.findUnique({ where: { stripeCustomerId: customerId } })) ??
    (metadataUserId ? await prisma.user.findUnique({ where: { id: metadataUserId } }) : null)
  );
}

// Replaces the user's Entitlement rows with the customer's active entitlements.
//
// From the webhook, `summary` is the event's active_entitlement_summary, which
// Stripe documents as the customer's full, up-to-date list (capped at 10 - beyond
// that we page through the List Active Entitlements API). `asOf` is the event's
// created time: summaries older than the last one applied are ignored, so
// out-of-order deliveries can't resurrect or revoke access wrongly.
// Without a summary (e.g. on return from Checkout) it lists them from the API.
export async function syncEntitlements(
  customerId: string,
  summary?: { lookupKeys: string[]; hasMore: boolean; asOf: Date },
): Promise<void> {
  const user = await userForCustomer(customerId);
  if (!user) {
    console.warn(`Stripe entitlements for customer ${customerId} have no matching user`);
    return;
  }
  if (summary && user.entitlementsSyncedAt && summary.asOf < user.entitlementsSyncedAt) return;

  let lookupKeys: string[];
  if (summary && !summary.hasMore) {
    lookupKeys = summary.lookupKeys;
  } else {
    lookupKeys = [];
    for await (const ent of stripe().entitlements.activeEntitlements.list({ customer: customerId })) {
      lookupKeys.push(ent.lookup_key);
    }
  }
  const asOf = summary?.asOf ?? new Date();

  await prisma.$transaction([
    prisma.entitlement.deleteMany({ where: { userId: user.id, type: { notIn: lookupKeys } } }),
    ...lookupKeys.map((type) =>
      prisma.entitlement.upsert({
        where: { userId_type: { userId: user.id, type } },
        create: { userId: user.id, type },
        update: {},
      }),
    ),
    prisma.user.update({ where: { id: user.id }, data: { entitlementsSyncedAt: asOf } }),
  ]);
}

// Fetches the subscription fresh from Stripe and upserts our mirror of it, storing
// the subscription and customer IDs as the guide recommends.
export async function syncSubscription(subscriptionId: string): Promise<void> {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const user = await userForCustomer(customerId, sub.metadata.userId);
  if (!user) {
    console.warn(`Stripe subscription ${sub.id} has no matching user (customer ${customerId})`);
    return;
  }

  const item = sub.items.data[0];
  const data = {
    stripeSubscriptionId: sub.id,
    stripePriceId: item?.price.id ?? "",
    status: sub.status,
    currentPeriodEnd: new Date((item?.current_period_end ?? sub.created) * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };

  // One Subscription row per user: a resubscribe after cancellation replaces the
  // old (canceled) row. Ignore updates for an older subscription once a newer one
  // is live, so a late event for the canceled one can't clobber it.
  const existing = await prisma.subscription.findUnique({ where: { userId: user.id } });
  if (
    existing &&
    existing.stripeSubscriptionId !== sub.id &&
    LIVE_STATUSES.has(existing.status) &&
    !LIVE_STATUSES.has(sub.status)
  ) {
    return;
  }

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });
}

export async function hasLiveSubscription(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return !!sub && LIVE_STATUSES.has(sub.status);
}

export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const sub = invoice.parent?.subscription_details?.subscription;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
}

export function idOf(ref: string | { id: string }): string {
  return typeof ref === "string" ? ref : ref.id;
}
