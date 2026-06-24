// Authentication is enabled automatically once an email key is configured.
// With no AUTH_RESEND_KEY set, the app runs in "open" mode (no sign-in) so it
// can be deployed and used with just a database. Add AUTH_RESEND_KEY (and the
// allowlist) later to turn magic-link sign-in on — no code change needed.
export const AUTH_ENABLED = !!process.env.AUTH_RESEND_KEY;
