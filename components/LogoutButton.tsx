"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useNotify } from "@/components/Notify";

export function LogoutButton({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw error;
      router.push("/login");
      router.refresh();
    } catch (e) {
      notify(`[ERROR: ${e instanceof Error ? e.message : "logout failed"}]`);
      setBusy(false);
    }
  }

  return (
    <button onClick={logout} disabled={busy} className={className}>
      {busy ? "…" : (children ?? "Log out")}
    </button>
  );
}
