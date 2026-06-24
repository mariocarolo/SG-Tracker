import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AUTH_ENABLED } from "@/lib/flags";
import TrackerApp from "@/components/TrackerApp";

export default async function Page() {
  if (!AUTH_ENABLED) {
    // Open mode — no sign-in required (no email key configured yet).
    return <TrackerApp userEmail={null} authEnabled={false} />;
  }
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <TrackerApp userEmail={session.user.email ?? null} authEnabled />;
}
