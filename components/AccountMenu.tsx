"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, PenLine, Plus, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Label, ThemeToggle } from "@/components/nothing";
import { LogoutButton } from "@/components/LogoutButton";

// Self-contained so it can live inside both server and client headers: it reads
// the signed-in user via the browser Supabase client.
export function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  // Not signed in (e.g. /login) — just expose the theme switch.
  if (!email) return <ThemeToggle />;

  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <div className="flex items-center gap-6">
      <Link href="/write" className="label hover:text-primary flex items-center gap-1.5">
        <PenLine size={13} />
        WRITE
      </Link>
      <Link href="/upload" className="label hover:text-primary flex items-center gap-1.5">
        <Plus size={13} />
        NEW
      </Link>
      <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        className="w-9 h-9 rounded-full border border-border-strong flex items-center justify-center font-mono text-label text-primary hover:border-primary"
      >
        {initial}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-60 bg-surface border border-border-strong rounded-[8px] p-2 z-20">
            <div className="px-3 py-2 border-b border-border">
              <Label>Signed in</Label>
              <p className="text-primary text-label font-mono truncate">
                {email}
              </p>
            </div>
            <div className="px-3 py-2 flex items-center justify-between border-b border-border">
              <Label>Theme</Label>
              <ThemeToggle />
            </div>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-primary text-label hover:bg-surface-raised rounded-[4px]"
            >
              <Settings size={15} />
              Settings
            </Link>
            <LogoutButton className="w-full flex items-center gap-2 text-left px-3 py-2 text-accent text-label hover:bg-surface-raised rounded-[4px]">
              <LogOut size={15} />
              Log out
            </LogoutButton>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
