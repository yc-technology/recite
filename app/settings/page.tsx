import { AppHeader } from "@/components/AppHeader";
import { Card, Label, ThemeToggle } from "@/components/nothing";
import { LogoutButton } from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-xl px-6 md:px-10 py-12 md:py-16 space-y-10">
        <div className="space-y-3">
          <Label>Account</Label>
          <h1 className="font-grotesk font-light text-display text-[clamp(1.8rem,5vw,2.5rem)] leading-[1.05] tracking-[-0.02em]">
            Settings
          </h1>
        </div>

        <Card className="space-y-1">
          <Label>Signed in as</Label>
          <p className="text-primary font-mono text-body break-all">
            {user?.email ?? "—"}
          </p>
        </Card>

        <Card className="flex items-center justify-between">
          <div className="space-y-1">
            <Label>Appearance</Label>
            <p className="text-secondary text-label">Light / dark theme</p>
          </div>
          <ThemeToggle />
        </Card>

        <LogoutButton className="w-full border border-border-strong rounded-[4px] px-5 py-3 font-mono uppercase tracking-[0.08em] text-caption text-accent hover:border-accent">
          Log out
        </LogoutButton>
      </main>
    </>
  );
}
