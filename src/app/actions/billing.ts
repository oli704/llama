"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
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

export async function startCheckout(returnTo: string) {
  const userId = await requireUserId();
  const returnPath = safeReturnPath(returnTo);

  // Already subscribed: send them to manage the existing subscription instead of
  // letting them buy a second one.
  if ((await hasFullAccess(userId)) || (await hasLiveSubscription(userId))) redirect("/account");

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) throw new Error("STRIPE_PRICE_ID is not set");

  const origin = await appOrigin();
  const customer = await getOrCreateStripeCustomer(userId);

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: { metadata: { userId } },
    metadata: { userId, returnTo: returnPath },
    allow_promotion_codes: true,
    success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${returnPath}`,
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
    return_url: `${origin}/account`,
  });
  redirect(portal.url);
}
