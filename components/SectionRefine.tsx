"use client";

import { useState } from "react";
import { Sparkles, Check, RotateCcw, X } from "lucide-react";
import { Button, Label } from "@/components/nothing";
import { SpeakableMarkdown } from "@/components/SpeakableMarkdown";
import { useNotify } from "@/components/Notify";

// Self-contained per-section refine UI: renders the current optimized text and,
// on demand, an LLM-generated draft the user can accept / regenerate / discard.
export function SectionRefine({
  presentationId,
  sectionIndex,
  optimized: initialOptimized,
}: {
  presentationId: string;
  sectionIndex: number;
  optimized: string;
}) {
  const notify = useNotify();
  const [optimized, setOptimized] = useState(initialOptimized);
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [lastInstruction, setLastInstruction] = useState("");
  const [candidate, setCandidate] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [accepting, setAccepting] = useState(false);

  async function generate(text: string) {
    const q = text.trim();
    if (!q || generating) return;
    setGenerating(true);
    setLastInstruction(q);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presentationId, sectionIndex, instruction: q }),
      });
      if (!res.ok) throw new Error(`refine failed (${res.status})`);
      const { optimized: draft } = await res.json();
      setCandidate(draft);
    } catch (e) {
      notify(`[ERROR: ${e instanceof Error ? e.message : "refine failed"}]`);
    } finally {
      setGenerating(false);
    }
  }

  async function accept() {
    if (candidate == null || accepting) return;
    setAccepting(true);
    try {
      const res = await fetch("/api/refine", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ presentationId, sectionIndex, optimized: candidate }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      setOptimized(candidate);
      setCandidate(null);
      setInstruction("");
      setOpen(false);
    } catch (e) {
      notify(`[ERROR: ${e instanceof Error ? e.message : "save failed"}]`);
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label className="!text-success">Optimized · double-click a paragraph to hear it</Label>
      <div className={candidate != null ? "opacity-40" : ""}>
        <SpeakableMarkdown>{optimized}</SpeakableMarkdown>
      </div>

      {(generating || candidate != null) && (
        <div className="border border-dashed border-accent rounded-[6px] p-3 space-y-3">
          <Label className="!text-accent flex items-center gap-1.5">
            <Sparkles size={13} />
            {generating ? "Draft · generating…" : `Draft · "${lastInstruction}"`}
          </Label>
          {generating ? (
            <div className="space-y-2">
              <div className="h-3 bg-surface-raised rounded-[2px] w-5/6" />
              <div className="h-3 bg-surface-raised rounded-[2px] w-2/3" />
              <div className="h-3 bg-surface-raised rounded-[2px] w-3/4" />
            </div>
          ) : (
            candidate != null && (
              <>
                <SpeakableMarkdown>{candidate}</SpeakableMarkdown>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" onClick={accept} disabled={accepting} className="!px-4 !py-2 gap-1.5">
                    <Check size={13} />
                    {accepting ? "SAVING…" : "ACCEPT"}
                  </Button>
                  <Button variant="ghost" onClick={() => generate(lastInstruction)} className="!px-4 !py-2 gap-1.5">
                    <RotateCcw size={13} />
                    REGENERATE
                  </Button>
                  <Button variant="ghost" onClick={() => setCandidate(null)} className="!px-4 !py-2 gap-1.5">
                    <X size={13} />
                    DISCARD
                  </Button>
                </div>
              </>
            )
          )}
        </div>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="label hover:text-primary flex items-center gap-1.5"
        >
          <Sparkles size={13} />
          REFINE
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            autoFocus
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generate(instruction)}
            placeholder="how should I improve this? e.g. make it more conversational"
            className="flex-1 bg-surface border border-border rounded-[4px] px-3 py-2 text-primary text-body focus:border-primary outline-none"
          />
          <Button variant="primary" onClick={() => generate(instruction)} disabled={generating} className="gap-1.5">
            <Sparkles size={13} />
            {generating ? "OPTIMIZING…" : "OPTIMIZE"}
          </Button>
        </div>
      )}
    </div>
  );
}
