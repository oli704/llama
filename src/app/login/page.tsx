import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { isGuestEmail, rememberCurrentGuest } from "@/lib/guest";
import { continueAsGuest } from "@/app/actions/guest";
import { PendingButton } from "@/app/components/PendingButton";

export const metadata = { title: "Sign in" };

// Auth.js error codes (see pages.error in src/auth.ts). "Configuration" is also what a
// failed sign-in email reports, which is the usual cause here.
const ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    "We couldn't send a sign-in email to that address. Check it's correct and try again, or continue without an account.",
  Verification: "That sign-in link has expired or has already been used. Enter your email to get a new one.",
};
const DEFAULT_ERROR = "Something went wrong signing you in. Please try again.";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Auth.js returns people to the page they signed in from - this one - so send
  // anyone already signed in (guests excepted) on to the app.
  const user = (await auth())?.user;
  if (user && !isGuestEmail(user.email)) redirect("/");

  const { error } = await searchParams;
  const errorMessage = typeof error === "string" ? (ERROR_MESSAGES[error] ?? DEFAULT_ERROR) : null;

  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {errorMessage && (
        <p role="alert" className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {errorMessage}
        </p>
      )}
      <p className="text-sm text-neutral-600">
        We&apos;ll email you a link - no password needed.
      </p>
      <form
        action={async (formData) => {
          "use server";
          await rememberCurrentGuest();
          await signIn("nodemailer", formData);
        }}
        className="space-y-3"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="w-full rounded border border-neutral-300 px-3 py-2"
        />
        <button type="submit" className="w-full rounded bg-neutral-900 px-4 py-2 text-white">
          Send sign-in link
        </button>
      </form>
      <form action={continueAsGuest.bind(null, "/")} className="border-t border-neutral-200 pt-4">
        <PendingButton
          className="w-full rounded border border-neutral-300 px-4 py-2 text-sm"
          pendingLabel="Setting things up…"
        >
          Continue without an account
        </PendingButton>
      </form>
    </div>
  );
}
