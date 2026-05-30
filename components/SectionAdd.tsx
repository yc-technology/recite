"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { Button, Card, Label } from "@/components/nothing";
import { Markdown } from "@/components/Markdown";
import { useNotify } from "@/components/Notify";
import type { Section } from "@/lib/agent/schema";

const STYLES = ["simple", "native", "formal", "concise"] as const;

// Lets the user paste raw text, generate one enriched section via the LLM
// pipeline, preview it, choose a position, and insert it into the plan.
export function SectionAdd({
  id,
  sectionTitles,
}: {
  id: string;
  sectionTitles: string[]; // existing section titles, in order
}) {
  const router = useRouter();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [style, setStyle] = useState<(typeof STYLES)[number]>("simple");
  const [position, setPosition] = useState(sectionTitles.length); // default: end
  const [candidate, setCandidate] = useState<Section | null>(null);
  const [generating, setGenerating] = useState(false);
  const [inserting, setInserting] = useState(false);

  function reset() {
    setOpen(false);
    setRawText("");
    setCandidate(null);
    setPosition(sectionTitles.length);
  }

  async function generate() {
    if (!rawText.trim() || generating) return;
    setGenerating(true);
    setCandidate(null);
    try {
      const res = await fetch("/api/section", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presentationId: id, rawText, style }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "generate failed");
      const { section } = await res.json();
      setCandidate(section as Section);
    } catch (e) {
      notify(e instanceof Error ? e.message : "generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function insert() {
    if (!candidate || inserting) return;
    setInserting(true);
    try {
      const res = await fetch("/api/section", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presentationId: id, position, section: candidate }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "save failed");
      reset();
      router.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : "save failed");
    } finally {
      setInserting(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="label hover:text-primary flex items-center gap-1.5"
      >
        <Plus size={13} />
        NEW SECTION
      </button>
    );
  }

  return (
    <Card className="space-y-3 border-border-strong">
      <div className="flex items-center justify-between">
        <Label>New section</Label>
        <button onClick={reset} aria-label="Close" className="text-secondary hover:text-primary">
          <X size={15} />
        </button>
      </div>

      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="Paste the text for the new section…"
        rows={5}
        className="w-full bg-surface border border-border rounded-[6px] p-3 text-body text-primary"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="label flex items-center gap-2">
          Position
          <select
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
            className="bg-surface border border-border rounded-[4px] px-2 py-1 text-label text-primary"
          >
            {sectionTitles.map((t, i) => (
              <option key={i} value={i}>{`Before ${i + 1}. ${t}`}</option>
            ))}
            <option value={sectionTitles.length}>At end</option>
          </select>
        </label>

        <label className="label flex items-center gap-2">
          Style
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as (typeof STYLES)[number])}
            className="bg-surface border border-border rounded-[4px] px-2 py-1 text-label text-primary"
          >
            {STYLES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <Button onClick={generate} disabled={generating || !rawText.trim()}>
          {generating ? "GENERATING…" : "GENERATE"}
        </Button>
      </div>

      {candidate && (
        <div className="space-y-3 border-t border-border pt-3">
          <h3 className="font-grotesk font-medium text-primary text-title">{candidate.title}</h3>
          {candidate.summary && (
            <p className="text-secondary text-body leading-relaxed">{candidate.summary}</p>
          )}
          <Markdown>{candidate.optimized}</Markdown>
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={insert} disabled={inserting}>
              {inserting ? "INSERTING…" : "CONFIRM INSERT"}
            </Button>
            <button onClick={() => setCandidate(null)} className="label hover:text-primary">
              DISCARD
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
