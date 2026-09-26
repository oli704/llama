import Stripe from "stripe";

// Lazily constructed so a missing STRIPE_SECRET_KEY only fails the billing paths
// that need it, not every page that imports this module.
let client: Stripe | undefined;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key);
  }
  return client;
}
