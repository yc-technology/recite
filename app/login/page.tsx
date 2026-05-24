"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button, Label } from "@/components/nothing";
import { useNotify } from "@/components/Notify";

const REMEMBER_KEY = "recite:email";

export default function LoginPage() {
  const notify = useNotify();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [insecure, setInsecure] = useState(false);

  // Prefill the remembered email on load (password is left to the browser's
  // password manager via autoComplete).
  useEffect(() => {
    // Auth needs Web Crypto, which browsers disable on non-HTTPS origins that
    // aren't localhost (e.g. http://<LAN-IP>). Detect and explain instead of
    // failing silently.
    setInsecure(!window.isSecureContext);
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

    // Field-level validation, shown inline next to each input.
    const errs: { email?: string; password?: string } = {};
    if (!email) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Enter a valid email address";
    if (!password) errs.password = "Password is required";
    else if (kind === "up" && password.length < 6)
      errs.password = "At least 6 characters";
    setErrors(errs);
    if (errs.email || errs.password) return;

    if (!window.isSecureContext) {
      notify("[ERROR: sign-in needs HTTPS — open this page over https or on localhost]");
      return;
    }
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, email);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {}
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } =
        kind === "in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (error) {
        notify(`[ERROR: ${error.message}]`);
        return;
      }
      if (kind === "up") {
        notify("[ CHECK EMAIL TO CONFIRM ]", "info");
        return;
      }
      // Full-page navigation (not router.push): guarantees the freshly-set auth
      // cookie is sent on the next request, avoiding a race where edge middleware
      // sees no session yet and bounces back to /login.
      window.location.assign("/");
    } catch (e) {
      notify(`[ERROR: ${e instanceof Error ? e.message : "login failed"}]`);
    } finally {
      setBusy(false);
    }
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
        {insecure && (
          <div className="border border-accent rounded-[4px] px-4 py-3 space-y-1">
            <p className="font-mono text-[12px] text-accent">
              [ INSECURE ORIGIN ]
            </p>
            <p className="text-secondary text-[13px] leading-relaxed">
              Sign-in needs HTTPS. This page is served over plain HTTP, so the
              browser blocks the crypto auth requires. Open it via{" "}
              <span className="text-primary font-mono">localhost</span> or an{" "}
              <span className="text-primary font-mono">https://</span> URL.
            </p>
          </div>
        )}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <input
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              onChange={() => setErrors((e) => ({ ...e, email: undefined }))}
              className={`w-full bg-surface border rounded-[4px] px-4 py-3 text-primary font-mono text-[16px] focus:border-primary outline-none ${
                errors.email ? "border-accent" : "border-border"
              }`}
            />
            {errors.email && (
              <p className="font-mono text-[11px] text-accent">{errors.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Password</Label>
            <input
              ref={passwordRef}
              type="password"
              name="password"
              autoComplete="current-password"
              onChange={() => setErrors((e) => ({ ...e, password: undefined }))}
              onKeyDown={(e) => e.key === "Enter" && run("in")}
              className={`w-full bg-surface border rounded-[4px] px-4 py-3 text-primary font-mono text-[16px] focus:border-primary outline-none ${
                errors.password ? "border-accent" : "border-border"
              }`}
            />
            {errors.password && (
              <p className="font-mono text-[11px] text-accent">
                {errors.password}
              </p>
            )}
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
        </div>
      </main>
    </>
  );
}
