"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button, Label } from "@/components/nothing";

type Draft = { rawText: string; title: string; sourceType: string };
type Busy = "idle" | "parsing" | "analyzing";

export default function UploadPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>("idle");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy("parsing");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload-parse", { method: "POST", body: fd });
      if (!res.ok) throw new Error(`parse failed (${res.status})`);
      setDraft(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "parse failed");
    } finally {
      setBusy("idle");
    }
  }

  async function analyze() {
    if (!draft) return;
    setError(null);
    setBusy("analyzing");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(`analysis failed (${res.status})`);
      const { id } = await res.json();
      router.push(`/presentation/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "analysis failed");
      setBusy("idle");
    }
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl px-6 md:px-10 py-12 md:py-20 space-y-10">
        <div className="space-y-3">
          <Label>Step 01 — Source</Label>
          <h1 className="font-grotesk font-light text-display text-[clamp(2rem,6vw,3rem)] leading-[1.05] tracking-[-0.02em]">
            Drop your presentation.
          </h1>
          <p className="text-secondary text-[16px] max-w-md">
            PDF, PPTX, Markdown, or plain text. We extract the script, then an
            agent builds your recitation plan.
          </p>
        </div>

        <label className="block border border-border-strong rounded-[8px] dot-grid px-6 py-10 text-center cursor-pointer hover:border-primary">
          <input
            type="file"
            accept=".pdf,.pptx,.md,.txt"
            onChange={onFile}
            className="hidden"
          />
          <Label className="!text-primary">
            {busy === "parsing" ? "[ PARSING… ]" : "[ CHOOSE FILE ]"}
          </Label>
        </label>

        {draft && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Title</Label>
              <input
                className="w-full bg-surface border border-border rounded-[4px] px-4 py-3 text-primary font-grotesk focus:border-primary outline-none"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Extracted script</Label>
                <Label>{draft.rawText.length} chars</Label>
              </div>
              <textarea
                className="w-full h-64 bg-surface border border-border rounded-[4px] px-4 py-3 text-primary font-mono text-[13px] leading-relaxed focus:border-primary outline-none"
                value={draft.rawText}
                onChange={(e) =>
                  setDraft({ ...draft, rawText: e.target.value })
                }
              />
            </div>
            <Button
              variant="primary"
              onClick={analyze}
              disabled={busy === "analyzing" || !draft.rawText.trim()}
              className="w-full"
            >
              {busy === "analyzing"
                ? "[ BUILDING PLAN… ]"
                : "Generate study plan →"}
            </Button>
          </div>
        )}

        {error && (
          <p className="font-mono text-[12px] text-accent">[ERROR: {error}]</p>
        )}
      </main>
    </>
  );
}
