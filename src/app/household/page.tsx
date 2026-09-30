import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { upsertHousehold, addKid, removeKid } from "@/app/actions/household";
import { PendingButton } from "@/app/components/PendingButton";

export const metadata = { title: "Household" };

const AGE_BAND_LABEL: Record<string, string> = {
  BABY: "Baby (0-1)",
  TODDLER: "Toddler (1-3)",
  PRESCHOOLER: "Preschooler (3-5)",
};

// Common budget currencies; a household saved with another code keeps it as an option.
const CURRENCIES = ["EUR", "GBP", "USD", "CAD", "AUD", "CHF", "SEK", "NOK", "DKK"];

export default async function HouseholdPage({ searchParams }: PageProps<"/household">) {
  const userId = await requireUserId();
  const [household, tripCount, { saved }] = await Promise.all([
    prisma.household.findUnique({ where: { userId }, include: { kids: true } }),
    prisma.pastTrip.count({ where: { userId } }),
    searchParams,
  ]);
  const currency = household?.budgetCurrency ?? "EUR";
  const currencies = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">Household</h1>
        {saved === "1" && (
          <p role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            ✓ Household saved.{" "}
            {!household?.kids.length ? (
              "Next, add your kids below."
            ) : tripCount === 0 ? (
              <Link href="/trips" className="font-medium underline">
                Next: tell us about a past trip →
              </Link>
            ) : (
              <Link href="/suggestions/new" className="font-medium underline">
                Next: get suggestions →
              </Link>
            )}
          </p>
        )}
        <form action={upsertHousehold} className="space-y-3 rounded border border-neutral-200 bg-white p-4">
          <div>
            <label htmlFor="homeBase" className="block text-sm font-medium">Home base</label>
            <input
              id="homeBase"
              name="homeBase"
              required
              defaultValue={household?.homeBase ?? ""}
              placeholder="e.g. London, UK or Austin, Texas"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="budgetMin" className="block text-sm font-medium">Budget min</label>
              <input
                id="budgetMin"
                name="budgetMin"
                type="number"
                defaultValue={household?.budgetMin ?? ""}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="budgetMax" className="block text-sm font-medium">Budget max</label>
              <input
                id="budgetMax"
                name="budgetMax"
                type="number"
                defaultValue={household?.budgetMax ?? ""}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="budgetCurrency" className="block text-sm font-medium">Currency</label>
              <select
                id="budgetCurrency"
                name="budgetCurrency"
                defaultValue={currency}
                className="mt-1 w-full rounded border border-neutral-300 bg-white px-3 py-2"
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="tripLengthMaxDays" className="block text-sm font-medium">Max trip length (days)</label>
            <input
              id="tripLengthMaxDays"
              name="tripLengthMaxDays"
              type="number"
              defaultValue={household?.tripLengthMaxDays ?? 7}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="mustAvoids" className="block text-sm font-medium">Must-avoids (optional)</label>
            <textarea
              id="mustAvoids"
              name="mustAvoids"
              defaultValue={household?.mustAvoids ?? ""}
              placeholder="e.g. no camping, no long car rides"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <PendingButton className="rounded bg-neutral-900 px-4 py-2 text-white" pendingLabel="Saving…">
            Save household
          </PendingButton>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Kids</h2>
        <ul className="space-y-2">
          {household?.kids.map((kid) => (
            <li
              key={kid.id}
              className="flex items-center justify-between rounded border border-neutral-200 bg-white px-4 py-2"
            >
              <span>
                {kid.label} - {AGE_BAND_LABEL[kid.ageBand]}
              </span>
              <form action={removeKid.bind(null, kid.id)}>
                <button type="submit" className="text-sm text-red-600">
                  Remove
                </button>
              </form>
            </li>
          ))}
          {!household?.kids.length && (
            <li className="text-sm text-neutral-500">No kids added yet.</li>
          )}
        </ul>

        <form
          action={addKid}
          className="flex flex-col gap-3 rounded border border-neutral-200 bg-white p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label htmlFor="kidLabel" className="block text-sm font-medium">Name/label</label>
            <input
              id="kidLabel"
              name="label"
              required
              placeholder="e.g. eldest"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="ageBand" className="block text-sm font-medium">Age band</label>
            <select id="ageBand" name="ageBand" required className="mt-1 w-full rounded border border-neutral-300 px-3 py-2">
              <option value="BABY">Baby (0-1)</option>
              <option value="TODDLER">Toddler (1-3)</option>
              <option value="PRESCHOOLER">Preschooler (3-5)</option>
            </select>
          </div>
          <PendingButton className="rounded bg-neutral-900 px-4 py-2 text-white" pendingLabel="Adding…">
            Add kid
          </PendingButton>
        </form>
      </section>
    </div>
  );
}
