"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/session";
import { isGuestEmail } from "@/lib/guest";

// "Email me a sign-in link" on the post-checkout page. Someone who paid without
// signing in has an account under their checkout email but has never used it to sign
// in; this sends the usual magic link so they can get back in on another device (and
// shows them the address is really theirs). Back to the success page either way.
export async function emailSignInLink(checkoutSessionId: string) {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  let result = "sent";
  if (isGuestEmail(user.email)) {
    result = "failed";
  } else {
    try {
      // With redirect: false, Auth.js reports some failures as an error-page URL
      // rather than throwing.
      const next = await signIn("nodemailer", { email: user.email, redirect: false, redirectTo: "/" });
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
