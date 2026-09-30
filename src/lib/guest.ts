import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Guest accounts let people try Llama - and subscribe - without signing in first. A
// guest is an ordinary User with a placeholder email on a reserved domain, signed in
// with a database session we create here, so every page and action works unchanged.
// Signing in later with a real email switches to that email's account (Auth.js
// replaces the guest session); paying as a guest gives the guest account the email
// entered at Stripe Checkout, so they can sign back in to it.
const GUEST_EMAIL_DOMAIN = "guest.llama.invalid";

// Auth.js's default session lifetime.
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function isGuestEmail(email: string | null | undefined): boolean {
  return !!email?.endsWith(`@${GUEST_EMAIL_DOMAIN}`);
}

// The signed-in user's id, or a new guest's. Sets the session cookie, so it can only
// be called from a Server Function or Route Handler.
export async function getOrCreateUserId(): Promise<string> {
  const session = await auth();
  if (session?.user?.id) return session.user.id;

  const user = await prisma.user.create({
    data: { email: `${randomUUID()}@${GUEST_EMAIL_DOMAIN}` },
  });
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);
  await prisma.session.create({ data: { sessionToken, userId: user.id, expires } });

  // The cookie Auth.js reads for database sessions. It adds the __Secure- prefix when
  // the request is over https, so match that.
  const proto = (await headers()).get("x-forwarded-proto") ?? "http";
  const secure = proto === "https";
  (await cookies()).set(`${secure ? "__Secure-" : ""}authjs.session-token`, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    expires,
  });
  return user.id;
}

// Gives a guest who just paid the email they entered at Checkout, so they can sign
// back in to this account (and its subscription) from any device. Does nothing for
// real accounts, or if that email already belongs to another account.
export async function claimGuestEmail(userId: string | null, email: string | null | undefined) {
  if (!userId || !email) return;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !isGuestEmail(user.email)) return;

  // Auth.js's email provider normalises addresses the same way before looking them up.
  const normalized = email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: normalized } })) return;
  try {
    await prisma.user.update({ where: { id: userId }, data: { email: normalized } });
  } catch (err) {
    // Lost a race with a sign-up using the same email - leave the guest as it is.
    console.warn(`Could not give guest ${userId} their checkout email`, err);
  }
}
