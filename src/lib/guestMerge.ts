import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { hasLiveSubscription, syncEntitlements } from "@/lib/billing";
import { isGuestEmail, setGuestNotice, takeRememberedGuest, type GuestNotice } from "@/lib/guest";

// Auth.js sign-in event: if this browser was a guest (see rememberCurrentGuest), move
// the guest's things into the account that just signed in. Opening the sign-in link
// proves the email is theirs, which is what makes this safe - unlike Checkout, where
// anyone can type any email.
export async function moveRememberedGuestInto(userId: string) {
  const guestId = await takeRememberedGuest();
  if (!guestId) return;
  try {
    const notice = await mergeGuestInto(guestId, userId);
    if (notice) await setGuestNotice(notice);
  } catch (err) {
    // The sign-in itself still succeeds; the guest is left as it was.
    console.error(`Could not move guest ${guestId} into user ${userId}`, err);
  }
}

// Moves a guest's household, trips, suggestions and Full access into `userId`, then
// deletes the guest. The account keeps its own household if it has one. If both have
// a live subscription, the account keeps its own and the guest's is set to cancel at
// the end of the period it has already paid for, so it's never charged again.
async function mergeGuestInto(guestId: string, userId: string): Promise<GuestNotice | null> {
  if (guestId === userId) return null;
  const [guest, user] = await Promise.all([
    prisma.user.findUnique({ where: { id: guestId }, include: { household: true, subscription: true } }),
    prisma.user.findUnique({ where: { id: userId }, include: { household: true } }),
  ]);
  if (!guest || !user || !isGuestEmail(guest.email)) return null;

  const [guestLive, userLive] = await Promise.all([
    hasLiveSubscription(guestId),
    hasLiveSubscription(userId),
  ]);
  const moveSubscription = guestLive && !userLive;

  // Before touching the database: if this fails the guest (and its subscription)
  // stays put, rather than leaving a live subscription attached to nobody.
  if (guestLive && userLive && guest.subscription) {
    await stripe().subscriptions.update(guest.subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.pastTrip.updateMany({ where: { userId: guestId }, data: { userId } });
    await tx.suggestionSet.updateMany({ where: { userId: guestId }, data: { userId } });
    if (guest.household && !user.household) {
      await tx.household.update({ where: { id: guest.household.id }, data: { userId } });
    }
    if (moveSubscription) {
      // The account takes over the guest's Stripe customer (its own, if any, has no
      // live subscription). Entitlements are re-read from Stripe below.
      await tx.subscription.deleteMany({ where: { userId } });
      await tx.user.update({ where: { id: guestId }, data: { stripeCustomerId: null } });
      await tx.subscription.update({ where: { userId: guestId }, data: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: { stripeCustomerId: guest.stripeCustomerId, entitlementsSyncedAt: null },
      });
    }
    // Cascades the rest: sessions, entitlements, an unused household.
    await tx.user.delete({ where: { id: guestId } });
  });

  if (moveSubscription && guest.stripeCustomerId) {
    await syncEntitlements(guest.stripeCustomerId);
    return "moved-subscription";
  }
  return guestLive ? "cancelled-duplicate" : "moved";
}
