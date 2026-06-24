import { signIn } from "@/auth";

export const metadata = { title: "Sign in · Operating Plan" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { check?: string; error?: string };
}) {
  const checkEmail = searchParams?.check === "1";
  const error = searchParams?.error;

  return (
    <div className="pm">
      <div className="connect-wrap">
        <div className="connect-card">
          <h1>Operating Plan</h1>
          <div className="connect-sub">Implementation Tracker</div>

          {checkEmail ? (
            <>
              <p className="connect-text">
                Check your inbox. We&apos;ve sent you a one-time sign-in link — click it on this
                device to open the tracker. The link expires shortly, so use it soon.
              </p>
              <a className="btn ghost" href="/login">
                Use a different email
              </a>
            </>
          ) : (
            <>
              <p className="connect-text">
                Sign in with your work email. We&apos;ll email you a secure link — no password
                needed. Only approved members of the organization can access the tracker.
              </p>

              {error && (
                <div className="connect-note" style={{ borderColor: "#bf3b34", color: "#bf3b34" }}>
                  {error === "AccessDenied"
                    ? "That email isn't on the access list. Ask your administrator to add you."
                    : "Something went wrong sending the link. Please try again."}
                </div>
              )}

              <form
                action={async (formData: FormData) => {
                  "use server";
                  await signIn("resend", {
                    email: String(formData.get("email") || "").trim().toLowerCase(),
                    redirectTo: "/",
                  });
                }}
              >
                <input type="email" name="email" placeholder="you@yourcompany.com" required autoFocus />
                <div className="connect-actions">
                  <button className="btn" type="submit">
                    Email me a sign-in link
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="connect-fine">Access is restricted to your organization.</div>
        </div>
      </div>
    </div>
  );
}
