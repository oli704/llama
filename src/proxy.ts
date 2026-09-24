import { NextResponse } from "next/server";
import { auth } from "@/auth";

const publicRoutes = ["/login"];

export default auth((req) => {
  const isPublicRoute =
    publicRoutes.includes(req.nextUrl.pathname) ||
    req.nextUrl.pathname.startsWith("/api/auth");

  if (!req.auth && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
