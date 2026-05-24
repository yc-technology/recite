"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button, Label } from "@/components/nothing";

const REMEMBER_KEY = "recite:email";

export default function LoginPage() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);

  // Prefill the remembered email on load (password is left to the browser's
  // password manager via autoComplete).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved && emailRef.current) {
        emailRef.current.value = saved;
        setRemember(true);
      }
    } catch {}
  }, []);

  async function run(kind: "in" | "up") {
    // Read straight from the inputs so browser autofill (which may not fire
    // onChange) is always picked up.
    const email = emailRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";
    if (!email || !password) {
      setStatus("[ERROR: enter email and password]");
      return;
    }
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {}
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
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              className="w-full bg-surface border border-border rounded-[4px] px-4 py-3 text-primary font-mono text-[14px] focus:border-primary outline-none"
            />
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <input
              ref={passwordRef}
              type="password"
              name="password"
              autoComplete="current-password"
              onKeyDown={(e) => e.key === "Enter" && run("in")}
              className="w-full bg-surface border border-border rounded-[4px] px-4 py-3 text-primary font-mono text-[14px] focus:border-primary outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setRemember((r) => !r)}
            className="flex items-center gap-2 pt-1"
          >
            <span className={remember ? "text-success" : "text-disabled"}>
              {remember ? "☑" : "☐"}
            </span>
            <Label className="hover:text-primary">Remember this account</Label>
          </button>

          <div className="flex gap-2 pt-2">
            <Button
              variant="primary"
              className="flex-1"
              disabled={busy}
              onClick={() => run("in")}
            >
              {busy ? "…" : "Sign in →"}
            </Button>
            <Button
              variant="outline"
              disabled={busy}
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
