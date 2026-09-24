import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="text-sm text-neutral-600">
        We&apos;ll email you a link - no password needed.
      </p>
      <form
        action={async (formData) => {
          "use server";
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
    </div>
  );
}
