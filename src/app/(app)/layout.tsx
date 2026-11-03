import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserAndProfile } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await getCurrentUserAndProfile();
  if (!user) {
    redirect("/login");
  }
  if (!profile?.is_active) {
    redirect("/login?error=inactive");
  }
  if (profile.must_change_password) {
    redirect("/cambiar-password");
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
