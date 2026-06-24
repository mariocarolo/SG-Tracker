import { redirect } from "next/navigation";
import { auth } from "@/auth";
import TrackerApp from "@/components/TrackerApp";

export default async function Page() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return <TrackerApp userEmail={session.user.email ?? null} />;
}
