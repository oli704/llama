import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { idOf, subscriptionIdFromInvoice, syncEntitlements, syncSubscription } from "@/lib/billing";

// Stripe -> app sync. Subscription events re-fetch the subscription from Stripe, and
// entitlement summaries are applied only if newer than the last one, so delivery
// order and retries don't matter. Register this endpoint in the Stripe
// Dashboard (Workbench -> Webhooks) with the events below.
// Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new Response("Webhook not configured", { status: 400 });
  }

  // Signature verification needs the raw, unparsed body.
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      // Access: Stripe grants/revokes the Full access feature as the subscription
      // starts, lapses or is cancelled. This is the only event that changes access.
      case "entitlements.active_entitlement_summary.updated": {
        const summary = event.data.object;
        await syncEntitlements(summary.customer, {
          lookupKeys: summary.entitlements.data.map((e) => e.lookup_key),
          hasMore: summary.entitlements.has_more,
          asOf: new Date(event.created * 1000),
        });
        break;
      }

      // Subscription details for the account page. checkout.session.completed can
      // arrive before payment settles for delayed payment methods - that's fine,
      // because it doesn't grant access; entitlements only appear once it's paid.
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          await syncSubscription(idOf(session.subscription));
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(event.data.object.id);
        break;

      // invoice.paid: renewal succeeded. invoice.payment_failed: the subscription goes
      // past_due, which the homepage and account page surface with a link to the
      // customer portal to update the card (Stripe's failed-payment emails, enabled in
      // Billing settings, notify the customer too).
      case "invoice.paid":
      case "invoice.payment_failed": {
        const subscriptionId = subscriptionIdFromInvoice(event.data.object);
        if (subscriptionId) await syncSubscription(subscriptionId);
        break;
      }
    }
  } catch (err) {
    // Non-2xx makes Stripe retry the delivery.
    console.error(`Failed to handle Stripe ${event.type} (${event.id})`, err);
    return new Response("Sync failed", { status: 500 });
  }

  return new Response(null, { status: 200 });
}
