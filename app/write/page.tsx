"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Button, Label } from "@/components/nothing";
import { SpeakableMarkdown } from "@/components/SpeakableMarkdown";
import { useNotify } from "@/components/Notify";
import { stripMarkdown } from "@/lib/tts";

type Style = "simple" | "native" | "formal" | "concise";
type Busy = "idle" | "reviewing" | "converting";
type Issue = { excerpt: string; type: string; explanation: string; fix: string };
type Review = { corrected: string; issues: Issue[]; comment: string };

const STYLES: { value: Style; label: string }[] = [
  { value: "simple", label: "Simple" },
  { value: "native", label: "Native" },
  { value: "formal", label: "Formal" },
  { value: "concise", label: "Concise" },
];
const GOALS = ["general", "email", "talk", "essay", "message"];

function deriveTitle(md: string): string {
  const words = stripMarkdown(md).split(/\s+/).filter(Boolean).slice(0, 6);
  return words.length ? words.join(" ") : "My writing";
}

export default function WritePage() {
  const router = useRouter();
  const notify = useNotify();
  const [text, setText] = useState("");
  const [style, setStyle] = useState<Style>("native");
  const [goal, setGoal] = useState("general");
  const [busy, setBusy] = useState<Busy>("idle");
  const [review, setReview] = useState<Review | null>(null);

  async function check() {
    if (!text.trim()) return;
    setBusy("reviewing");
    setReview(null);
    try {
      const res = await fetch("/api/write-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, style, goal }),
      });
      if (!res.ok) throw new Error(`review failed (${res.status})`);
      setReview(await res.json());
    } catch (e) {
      notify(`[ERROR: ${e instanceof Error ? e.message : "review failed"}]`);
    } finally {
      setBusy("idle");
    }
  }

  async function toPresentation() {
    if (!review) return;
    setBusy("converting");
    try {
      const nRes = await fetch("/api/normalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rawText: review.corrected }),
      });
      if (!nRes.ok) throw new Error(`normalize failed (${nRes.status})`);
      const { sections } = await nRes.json();
      const aRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: deriveTitle(review.corrected),
          sourceType: "writing",
          style,
          sections,
        }),
      });
      if (!aRes.ok) throw new Error(`analysis failed (${aRes.status})`);
      const { id } = await aRes.json();
      router.push(`/presentation/${id}`);
    } catch (e) {
      notify(`[ERROR: ${e instanceof Error ? e.message : "convert failed"}]`);
      setBusy("idle");
    }
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl px-6 md:px-10 py-12 md:py-16">
        <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Write" }]} />

        <div className="space-y-3 mb-8">
          <Label>Writing coach</Label>
          <h1 className="font-grotesk font-light text-display text-[clamp(2rem,6vw,3rem)] leading-[1.05] tracking-[-0.02em]">
            Write it. Get it fixed.
          </h1>
          <p className="text-secondary text-body">
            Draft anything in English — the coach corrects it, shows a better
            version, and you can turn it into a deck to rehearse.
          </p>
        </div>

        <div className="space-y-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write or paste your English here…"
            className="w-full h-48 bg-surface border border-border rounded-[6px] px-4 py-3 text-primary font-grotesk text-body leading-relaxed focus:border-primary outline-none"
          />

          <div className="flex flex-wrap gap-6">
            <div className="space-y-2">
              <Label>Goal</Label>
              <div className="flex flex-wrap gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGoal(g)}
                    className={`label border rounded-[4px] px-2.5 py-1 ${
                      goal === g
                        ? "border-accent text-primary"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Style</Label>
              <div className="flex flex-wrap gap-2">
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStyle(s.value)}
                    className={`label border rounded-[4px] px-2.5 py-1 ${
                      style === s.value
                        ? "border-accent text-primary"
                        : "border-border hover:border-border-strong"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={check}
            disabled={busy !== "idle" || !text.trim()}
            className="w-full gap-2"
          >
            {busy === "reviewing" ? (
              "[ CHECKING… ]"
            ) : (
              <>
                <Check size={15} />
                Check my writing
              </>
            )}
          </Button>
        </div>

        {review && (
          <div className="space-y-10 mt-12">
            {review.comment && (
              <p className="text-secondary text-body leading-relaxed border-l-2 border-accent pl-4">
                {review.comment}
              </p>
            )}

            {review.issues.length > 0 && (
              <section className="space-y-3">
                <Label>Issues — {review.issues.length}</Label>
                <ul className="space-y-3">
                  {review.issues.map((it, i) => (
                    <li
                      key={i}
                      className="border border-border rounded-[6px] p-4 space-y-1.5"
                    >
                      <Label className="!text-warning">{it.type}</Label>
                      <p className="text-body">
                        <span className="text-accent line-through">
                          {it.excerpt}
                        </span>
                        <span className="text-disabled"> → </span>
                        <span className="text-success">{it.fix}</span>
                      </p>
                      <p className="text-secondary text-label leading-snug">
                        {it.explanation}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-2">
              <Label className="!text-success">
                Better version · double-click a paragraph to hear it
              </Label>
              <SpeakableMarkdown>{review.corrected}</SpeakableMarkdown>
            </section>

            <Button
              variant="primary"
              onClick={toPresentation}
              disabled={busy !== "idle"}
              className="w-full gap-2"
            >
              {busy === "converting" ? (
                "[ BUILDING DECK… ]"
              ) : (
                <>
                  Turn into a deck to rehearse
                  <ArrowRight size={15} />
                </>
              )}
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
