"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Button, Label } from "@/components/nothing";

type Section = { title: string; text: string };
type Busy = "idle" | "parsing" | "normalizing" | "analyzing";

export default function UploadPage() {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>("idle");
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState("text");
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSections(null);
    try {
      // 1) extract raw text
      setBusy("parsing");
      const fd = new FormData();
      fd.append("file", file);
      const pRes = await fetch("/api/upload-parse", { method: "POST", body: fd });
      if (!pRes.ok) throw new Error(`parse failed (${pRes.status})`);
      const parsed = await pRes.json();
      setTitle(parsed.title);
      setSourceType(parsed.sourceType);

      // 2) normalize messy text into clean, structured sections
      setBusy("normalizing");
      const nRes = await fetch("/api/normalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawText: parsed.rawText }),
      });
      if (!nRes.ok) throw new Error(`normalize failed (${nRes.status})`);
      const { sections } = await nRes.json();
      setSections(sections);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed");
    } finally {
      setBusy("idle");
    }
  }

  function updateSection(i: number, patch: Partial<Section>) {
    setSections((prev) =>
      prev ? prev.map((s, j) => (j === i ? { ...s, ...patch } : s)) : prev,
    );
  }
  function removeSection(i: number) {
    setSections((prev) => (prev ? prev.filter((_, j) => j !== i) : prev));
  }

  async function analyze() {
    if (!sections?.length) return;
    setError(null);
    setBusy("analyzing");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, sourceType, sections }),
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
      <main className="mx-auto w-full max-w-2xl px-6 md:px-10 py-12 md:py-16 space-y-10">
        <div className="space-y-3">
          <Label>Step 01 — Source</Label>
          <h1 className="font-grotesk font-light text-display text-[clamp(2rem,6vw,3rem)] leading-[1.05] tracking-[-0.02em]">
            Drop your presentation.
          </h1>
          <p className="text-secondary text-[16px] max-w-md">
            PDF, PPTX, Markdown, or text. We clean it up, split it into sections,
            and you review before the coach builds your plan.
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
            {busy === "parsing"
              ? "[ PARSING… ]"
              : busy === "normalizing"
                ? "[ NORMALIZING… ]"
                : "[ CHOOSE FILE ]"}
          </Label>
        </label>

        {sections && (
          <div className="space-y-8">
            <div className="space-y-2">
              <Label>Title</Label>
              <input
                className="w-full bg-surface border border-border rounded-[4px] px-4 py-3 text-primary font-grotesk focus:border-primary outline-none"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Step 02 — Review sections ({sections.length})</Label>
              </div>
              {sections.map((s, i) => (
                <div
                  key={i}
                  className="space-y-2 border border-border rounded-[6px] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-secondary text-[12px] w-7">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <input
                      className="flex-1 bg-transparent border-b border-border text-primary font-grotesk font-medium focus:border-primary outline-none pb-1"
                      value={s.title}
                      onChange={(e) => updateSection(i, { title: e.target.value })}
                    />
                    <button
                      onClick={() => removeSection(i)}
                      className="label hover:text-accent"
                      aria-label="Remove section"
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    className="w-full h-32 bg-surface border border-border rounded-[4px] px-3 py-2 text-primary font-mono text-[13px] leading-relaxed focus:border-primary outline-none"
                    value={s.text}
                    onChange={(e) => updateSection(i, { text: e.target.value })}
                  />
                </div>
              ))}
            </div>

            <Button
              variant="primary"
              onClick={analyze}
              disabled={busy === "analyzing" || sections.length === 0}
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
