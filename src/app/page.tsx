import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Llama</h1>
        <p className="text-neutral-600">
          A kid-friendly reimagining of the trips you used to take, before kids.
        </p>
        <Link href="/login" className="inline-block rounded bg-neutral-900 px-4 py-2 text-white">
          Sign in
        </Link>
      </div>
    );
  }

  const [household, tripCount, latestSet] = await Promise.all([
    prisma.household.findUnique({ where: { userId: session.user.id }, include: { kids: true } }),
    prisma.pastTrip.count({ where: { userId: session.user.id } }),
    prisma.suggestionSet.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const steps = [
    {
      done: !!household && household.kids.length > 0 && !!household.homeBase.trim(),
      label: "Set up your household",
      href: "/household",
    },
    { done: tripCount > 0, label: "Tell us about a past trip", href: "/trips" },
    { done: !!latestSet, label: "Get your first suggestions", href: "/suggestions/new" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.href} className="flex items-center justify-between rounded border border-neutral-200 bg-white p-4">
            <span className={step.done ? "text-neutral-400 line-through" : ""}>{step.label}</span>
            <Link href={step.href} className="text-sm underline">
              {step.done ? "Edit" : "Start"}
            </Link>
          </li>
        ))}
      </ol>
      {latestSet && (
        <Link href={`/suggestions/${latestSet.id}`} className="inline-block text-sm underline">
          View your latest suggestions →
        </Link>
      )}
    </div>
  );
}
