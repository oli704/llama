"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { stripe } from "@/lib/stripe";
import { isGuestEmail, rememberCurrentGuest } from "@/lib/guest";

// "Email me a sign-in link" on the post-checkout page. Someone who paid without
// signing in has an account under their checkout email but has never used it to sign
// in; this sends the usual magic link so they can get back in on another device (and
// shows them the address is really theirs). If they're still a guest - their checkout
// email already had an account - the link goes to that email, and opening it in this
// browser moves their Full access into that account. Back to the success page either way.
export async function emailSignInLink(checkoutSessionId: string) {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  let email: string | null = user.email;
  if (isGuestEmail(user.email)) {
    email = null;
    if (checkoutSessionId.startsWith("cs_")) {
      const session = await stripe().checkout.sessions.retrieve(checkoutSessionId);
      if (session.client_reference_id === userId) email = session.customer_details?.email ?? null;
    }
    if (email) await rememberCurrentGuest();
  }

  let result = "sent";
  if (!email) {
    result = "failed";
  } else {
    try {
      // With redirect: false, Auth.js reports some failures as an error-page URL
      // rather than throwing.
      const next = await signIn("nodemailer", { email, redirect: false, redirectTo: "/" });
      if (new URL(next, "http://x").searchParams.has("error")) throw new Error(next);
    } catch (err) {
      console.error(`Could not email a sign-in link to user ${userId}`, err);
      result = "failed";
    }
  }

  const params = new URLSearchParams({ link: result });
  if (checkoutSessionId) params.set("session_id", checkoutSessionId);
  redirect(`/billing/success?${params}`);
}
