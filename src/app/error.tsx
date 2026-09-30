"use client";

import Link from "next/link";

// Friendly fallback for anything a page or form action throws (e.g. the AI service
// having a bad moment), instead of the bare "This page couldn't load" screen.
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-4 rounded border border-neutral-200 bg-white p-6">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-sm text-neutral-700">
        That didn&apos;t work this time - usually a temporary hiccup. Nothing you entered has been
        lost. Please try again.
      </p>
      <div className="flex items-center gap-4">
        <button onClick={() => retry()} className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">
          Try again
        </button>
        <Link href="/" className="text-sm underline">
          Go to the homepage
        </Link>
      </div>
    </div>
  );
}
