import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  session: { strategy: "database" },
  // Errors (e.g. the sign-in email can't be sent, or an expired link) come back to the
  // sign-in page with ?error=, which explains them, instead of Auth.js's bare error page.
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    session({ session, user }) {
      if (session.user) session.user.id = user.id;
      return session;
    },
  },
  events: {
    // A guest signing in brings their trips and Full access along. Imported lazily
    // because that module imports this one.
    async signIn({ user }) {
      if (!user.id) return;
      const { moveRememberedGuestInto } = await import("@/lib/guestMerge");
      await moveRememberedGuestInto(user.id);
    },
  },
  providers: [
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
});
