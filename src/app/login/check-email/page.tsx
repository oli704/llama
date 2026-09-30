import Link from "next/link";

export const metadata = { title: "Check your email" };

// Where Auth.js sends people after requesting a sign-in link (pages.verifyRequest).
export default function CheckEmailPage() {
  return (
    <div className="mx-auto max-w-sm space-y-4 rounded border border-neutral-200 bg-white p-6 text-center">
      <p className="text-4xl" aria-hidden>
        📬
      </p>
      <h1 className="text-xl font-semibold">Check your email</h1>
      <p className="text-sm text-neutral-600">
        We&apos;ve sent you a sign-in link. Open it in this browser to carry on where you left
        off - it works once and expires in 24 hours.
      </p>
      <p className="text-xs text-neutral-500">
        Nothing there after a minute? Check your spam folder, or{" "}
        <Link href="/login" className="underline">
          try again
        </Link>
        .
      </p>
    </div>
  );
}
