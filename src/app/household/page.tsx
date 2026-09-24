import { requireUserId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { upsertHousehold, addKid, removeKid } from "@/app/actions/household";

const AGE_BAND_LABEL: Record<string, string> = {
  BABY: "Baby (0-1)",
  TODDLER: "Toddler (1-3)",
  PRESCHOOLER: "Preschooler (3-5)",
};

export default async function HouseholdPage() {
  const userId = await requireUserId();
  const household = await prisma.household.findUnique({
    where: { userId },
    include: { kids: true },
  });

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-xl font-semibold">Household</h1>
        <form action={upsertHousehold} className="space-y-3 rounded border border-neutral-200 bg-white p-4">
          <div>
            <label className="block text-sm font-medium">Home base</label>
            <input
              name="homeBase"
              required
              defaultValue={household?.homeBase ?? ""}
              placeholder="e.g. London, UK or Austin, Texas"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium">Budget min</label>
              <input
                name="budgetMin"
                type="number"
                defaultValue={household?.budgetMin ?? ""}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Budget max</label>
              <input
                name="budgetMax"
                type="number"
                defaultValue={household?.budgetMax ?? ""}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium">Currency</label>
              <input
                name="budgetCurrency"
                defaultValue={household?.budgetCurrency ?? ""}
                placeholder="USD"
                maxLength={3}
                className="mt-1 w-full rounded border border-neutral-300 px-3 py-2 uppercase"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Max trip length (days)</label>
            <input
              name="tripLengthMaxDays"
              type="number"
              defaultValue={household?.tripLengthMaxDays ?? 7}
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Must-avoids (optional)</label>
            <textarea
              name="mustAvoids"
              defaultValue={household?.mustAvoids ?? ""}
              placeholder="e.g. no camping, no long car rides"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-white">
            Save household
          </button>
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
            <label className="block text-sm font-medium">Name/label</label>
            <input
              name="label"
              required
              placeholder="e.g. eldest"
              className="mt-1 w-full rounded border border-neutral-300 px-3 py-2"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium">Age band</label>
            <select name="ageBand" required className="mt-1 w-full rounded border border-neutral-300 px-3 py-2">
              <option value="BABY">Baby (0-1)</option>
              <option value="TODDLER">Toddler (1-3)</option>
              <option value="PRESCHOOLER">Preschooler (3-5)</option>
            </select>
          </div>
          <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-white">
            Add kid
          </button>
        </form>
      </section>
    </div>
  );
}
