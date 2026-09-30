import { createTransport } from "nodemailer";
import type { NodemailerConfig } from "next-auth/providers/nodemailer";

// Llama-branded magic-link email. Auth.js's default subject is "Sign in to <host>",
// which on preview deployments is a long vercel.app address.
export async function sendSignInEmail({
  identifier,
  url,
  provider,
}: {
  identifier: string;
  url: string;
  provider: NodemailerConfig;
}) {
  const transport = createTransport(provider.server);
  const result = await transport.sendMail({
    to: identifier,
    from: provider.from,
    subject: "Your Llama sign-in link",
    text: `Sign in to Llama:\n${url}\n\nThis link works once and expires in 24 hours. If you didn't ask for it, you can ignore this email.\n`,
    html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#171717">
  <p style="font-size:20px;font-weight:600;margin:0 0 16px">🦙 Llama</p>
  <p style="margin:0 0 20px">Tap the button to sign in. The link works once and expires in 24 hours.</p>
  <p style="margin:0 0 24px"><a href="${url}" style="display:inline-block;background:#171717;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px">Sign in to Llama</a></p>
  <p style="font-size:12px;color:#737373;margin:0">If you didn't ask for this email, you can safely ignore it.</p>
</div>`,
  });
  const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
  if (failed.length) throw new Error(`Email (${failed.join(", ")}) could not be sent`);
}
