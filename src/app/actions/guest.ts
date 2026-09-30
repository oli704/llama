"use server";

import { redirect } from "next/navigation";
import { getOrCreateUserId } from "@/lib/guest";

// "Try it without an account": start a guest session (if not already signed in) and
// carry on to the app.
export async function continueAsGuest(next: string) {
  await getOrCreateUserId();
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
