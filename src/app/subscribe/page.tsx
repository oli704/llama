import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { PLAN, hasFullAccess } from "@/lib/billing";
import { startCheckout } from "@/app/actions/billing";
import { PendingButton } from "@/app/components/PendingButton";

// Order preview: summarises the plan before handing off to Stripe-hosted Checkout.
export default async function SubscribePage({ searchParams }: PageProps<"/subscribe">) {
  const userId = await requireUserId();
  if (await hasFullAccess(userId)) redirect("/account");

  const { returnTo } = await searchParams;
  const back = typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : "/";

  return (
    <div className="mx-auto max-w-md space-y-5 rounded border border-neutral-200 bg-white p-6">
      <div>
        <h1 className="text-xl font-semibold">{PLAN.name}</h1>
        <p className="mt-1 text-2xl font-semibold">{PLAN.priceLabel}</p>
      </div>
      <ul className="space-y-2 text-sm text-neutral-700">
        {PLAN.features.map((f) => (
          <li key={f}>✓ {f}</li>
        ))}
      </ul>
      <p className="text-xs text-neutral-500">
        Billed monthly until you cancel. You&apos;ll enter your payment details on a secure page
        hosted by Stripe.
      </p>
      <form action={startCheckout.bind(null, back)}>
        <PendingButton
          className="w-full rounded bg-emerald-700 px-4 py-2 text-white"
          pendingLabel="Opening secure checkout…"
        >
          Continue to payment
        </PendingButton>
      </form>
      <Link href={back} className="block text-center text-sm text-neutral-500 underline">
        Not now
      </Link>
    </div>
  );
}
