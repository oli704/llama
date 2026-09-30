import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { auth, signOut } from "@/auth";
import { GUEST_NOTICE_COOKIE, isGuestEmail, type GuestNotice } from "@/lib/guest";
import { hasFullAccess } from "@/lib/billing";
import { CheckoutCancelledNotice } from "@/app/components/CheckoutCancelledNotice";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Pages set their own `title`, shown as e.g. "Household · Llama".
  title: { default: "Llama - family trip re-creator", template: "%s · Llama" },
  description: "Kid-friendly reimaginings of the trips you used to take.",
};

// Shown once after signing in from a guest browser moved the guest's things across.
const GUEST_NOTICES: Record<GuestNotice, string> = {
  moved: "Your trips from before you signed in are now in this account.",
  "moved-subscription": "Your Full access and trips from before you signed in are now in this account.",
  "cancelled-duplicate":
    "This account already had Full access, so we've cancelled the extra subscription from checkout - you won't be charged for it again. Your trips have moved across.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();
  const noticeKey = (await cookies()).get(GUEST_NOTICE_COOKIE)?.value as GuestNotice | undefined;
  const notice = session?.user && noticeKey ? GUEST_NOTICES[noticeKey] : undefined;
  const fullAccess = session?.user?.id ? await hasFullAccess(session.user.id) : false;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Link href="/" className="font-semibold">
              🦙 Llama
            </Link>
            {session?.user ? (
              <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:gap-x-4 sm:text-sm">
                <Link href="/household">Household</Link>
                <Link href="/trips">Trips</Link>
                <Link href="/suggestions/new">New suggestions</Link>
                <Link href="/saved">Saved</Link>
                <Link href="/account">Account</Link>
                {fullAccess && (
                  <Link
                    href="/account"
                    className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800"
                  >
                    ✓ Full access
                  </Link>
                )}
                {isGuestEmail(session.user.email) ? (
                  // Signing out would strand a guest's trips, so offer sign-in instead.
                  <Link href="/login" className="text-neutral-500 hover:text-neutral-900">
                    Guest · Sign in
                  </Link>
                ) : (
                  <form
                    action={async () => {
                      "use server";
                      await signOut();
                    }}
                  >
                    <button className="text-neutral-500 hover:text-neutral-900" type="submit">
                      Sign out
                    </button>
                  </form>
                )}
              </nav>
            ) : (
              <Link href="/login" className="text-sm">
                Sign in
              </Link>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:py-8">
          {notice && (
            <p role="status" className="mb-6 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {notice}
            </p>
          )}
          <Suspense>
            <CheckoutCancelledNotice />
          </Suspense>
          {children}
        </main>
      </body>
    </html>
  );
}
