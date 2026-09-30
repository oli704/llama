import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Signed-out visitors can see the homepage and the plan summary; both offer to carry
// on as a guest (see src/lib/guest.ts).
const publicRoutes = ["/", "/login", "/subscribe"];

export default auth((req) => {
  const isPublicRoute =
    publicRoutes.includes(req.nextUrl.pathname) ||
    req.nextUrl.pathname.startsWith("/api/auth") ||
    // Called by Stripe's servers (no session); authenticated by webhook signature instead.
    req.nextUrl.pathname === "/api/stripe/webhook";

  if (!req.auth && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
