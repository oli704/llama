import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Guest accounts let people try Llama - and subscribe - without signing in first. A
// guest is an ordinary User with a placeholder email on a reserved domain, signed in
// with a database session we create here, so every page and action works unchanged.
// Paying as a guest gives the guest account the email entered at Stripe Checkout, so
// they can sign back in to it. Signing in with an email (from the guest's browser)
// moves the guest's things into that account - see src/lib/guestMerge.ts.
const GUEST_EMAIL_DOMAIN = "guest.llama.invalid";

// Remembers which guest is signing in, so the sign-in can move the guest's things into
// the account (src/lib/guestMerge.ts). Auth.js drops the guest's session during
// sign-in, so this is the only link back. Signed with AUTH_SECRET so it can't be
// pointed at someone else's guest.
const GUEST_COOKIE = "llama-guest";
const GUEST_COOKIE_MAX_AGE_S = 24 * 60 * 60; // about as long as a sign-in link lasts

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
  const secure = await isHttps();
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

async function isHttps(): Promise<boolean> {
  return ((await headers()).get("x-forwarded-proto") ?? "http") === "https";
}

function signGuestId(guestId: string): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(`guest:${guestId}`).digest("base64url");
}

// Call before sending a sign-in link from a guest's browser. Server Functions only.
export async function rememberCurrentGuest() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !isGuestEmail(session.user?.email)) return;
  const signature = signGuestId(userId);
  if (!signature) return;
  (await cookies()).set(GUEST_COOKIE, `${userId}.${signature}`, {
    httpOnly: true,
    sameSite: "lax", // sent when the sign-in link is opened from an email
    path: "/",
    secure: await isHttps(),
    maxAge: GUEST_COOKIE_MAX_AGE_S,
  });
}

// The guest remembered by rememberCurrentGuest, if the cookie is genuine; clears it.
// Route Handlers / Server Functions only (Auth.js's sign-in callback runs in one).
export async function takeRememberedGuest(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(GUEST_COOKIE)?.value;
  if (!value) return null;
  store.delete(GUEST_COOKIE);

  const [guestId, signature] = value.split(".");
  const expected = guestId ? signGuestId(guestId) : null;
  if (!expected || !signature || signature.length !== expected.length) return null;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? guestId : null;
}

// One-off message shown after a guest's things were moved into an account (read by
// the layout). Short-lived rather than deleted, as pages can't delete cookies.
export const GUEST_NOTICE_COOKIE = "llama-notice";
export type GuestNotice = "moved" | "moved-subscription" | "cancelled-duplicate";

export async function setGuestNotice(notice: GuestNotice) {
  (await cookies()).set(GUEST_NOTICE_COOKIE, notice, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: await isHttps(),
    maxAge: 60,
  });
}
