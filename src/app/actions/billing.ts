"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getOrCreateUserId } from "@/lib/guest";
import { stripe } from "@/lib/stripe";
import { getOrCreateStripeCustomer, hasFullAccess, hasLiveSubscription } from "@/lib/billing";

async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Only same-site paths - never let a form field send the user off-site after Checkout.
function safeReturnPath(returnTo: string): string {
  return returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
}

// Signed-out visitors can subscribe straight away: they become a guest here, and
// Stripe Checkout collects their email.
export async function startCheckout(returnTo: string) {
  const userId = await getOrCreateUserId();
  const returnPath = safeReturnPath(returnTo);

  // Already subscribed: send them to manage the existing subscription instead of
  // letting them buy a second one.
  if ((await hasFullAccess(userId)) || (await hasLiveSubscription(userId))) redirect("/account?already=1");

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) throw new Error("STRIPE_PRICE_ID is not set");

  const origin = await appOrigin();
  const customer = await getOrCreateStripeCustomer(userId);
  // Backing out of Checkout returns to where they were, with a note that nothing was
  // charged (CheckoutCancelledNotice). Keeps any #anchor on the return path.
  const cancelUrl = new URL(returnPath, origin);
  cancelUrl.searchParams.set("checkout", "cancelled");

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { userId } },
    metadata: { userId, returnTo: returnPath },
    allow_promotion_codes: true,
    custom_text: { submit: { message: "Cancel anytime from your Llama account page." } },
    success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl.toString(),
  });

  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  redirect(session.url);
}

export async function openBillingPortal() {
  const userId = await requireUserId();
  const customer = await getOrCreateStripeCustomer(userId);
  const origin = await appOrigin();

  const portal = await stripe().billingPortal.sessions.create({
    customer,
    // The account page re-reads the subscription from Stripe on the way back, so a
    // cancellation shows straight away rather than when the webhook lands.
    return_url: `${origin}/account?from=portal`,
  });
  redirect(portal.url);
}
