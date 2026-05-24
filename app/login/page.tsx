"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button, Label } from "@/components/nothing";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(kind: "in" | "up") {
    setBusy(true);
    setStatus(null);
    const supabase = createClient();
    const { error } =
      kind === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setStatus(`[ERROR: ${error.message}]`);
      return;
    }
    if (kind === "up") {
      setStatus("[ CHECK EMAIL TO CONFIRM ]");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-sm px-6 py-20 md:py-28 space-y-10">
        <div className="space-y-3">
          <Label>Access</Label>
          <h1 className="font-grotesk font-light text-display text-[2.5rem] leading-[1.05] tracking-[-0.02em]">
            Sign in.
          </h1>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-surface border border-border rounded-[4px] px-4 py-3 text-primary font-mono text-[14px] focus:border-primary outline-none"
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface border border-border rounded-[4px] px-4 py-3 text-primary font-mono text-[14px] focus:border-primary outline-none"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="primary"
              className="flex-1"
              disabled={busy || !email || !password}
              onClick={() => run("in")}
            >
              Sign in →
            </Button>
            <Button
              variant="outline"
              disabled={busy || !email || !password}
              onClick={() => run("up")}
            >
              Sign up
            </Button>
          </div>
          {status && (
            <p className="font-mono text-[12px] text-accent">{status}</p>
          )}
        </div>
      </main>
    </>
  );
}
