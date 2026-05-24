"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Grade } from "@/lib/srs/sm2";
import { speak, stopSpeak } from "@/lib/tts";
import { Button, Label } from "@/components/nothing";
import { Markdown } from "@/components/Markdown";
import { SectionChat } from "@/components/SectionChat";
import { useNotify } from "@/components/Notify";

export type DueSection = {
  index: number;
  title: string;
  summary: string;
  keyPoints: string[];
  text: string; // original (原版)
  optimized: string; // polished rewrite (优化版)
  level: number; // mastery level 1..3 (1 = most scaffolding)
};

const GRADES: { grade: Grade; label: string; variant: "outline" | "primary" }[] =
  [
    { grade: Grade.Again, label: "Again", variant: "outline" },
    { grade: Grade.Hard, label: "Hard", variant: "outline" },
    { grade: Grade.Good, label: "Good", variant: "outline" },
    { grade: Grade.Easy, label: "Easy", variant: "primary" },
  ];
const GRADE_KEY = ["again", "hard", "good", "easy"] as const;

const levelHint: Record<number, string> = {
  1: "Explain this section in your own words, using the points below.",
  2: "Recall the key points and explain it — only the gist is shown.",
  3: "From the title alone, recall and explain the whole section.",
};

export function PracticeSession({
  id,
  sections,
}: {
  id: string;
  sections: DueSection[];
}) {
  const notify = useNotify();
  const total = sections.length;
  const [queue, setQueue] = useState<number[]>(() =>
    sections.map((_, i) => i),
  );
  const [finished, setFinished] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [startedAt] = useState(() => Date.now());

  const curPos = queue[0];
  const current = curPos != null ? sections[curPos] : undefined;

  useEffect(() => {
    setChecked(current ? current.keyPoints.map(() => false) : []);
    setRevealed(false);
    stopSpeak();
  }, [curPos]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopSpeak(), []);

  const grade = useCallback(
    async (g: Grade) => {
      if (!current || saving) return;
      setSaving(true);
      stopSpeak();
      try {
        const res = await fetch("/api/practice-review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, segmentIndex: current.index, grade: g }),
        });
        if (!res.ok) throw new Error(`save failed (${res.status})`);
      } catch (e) {
        // Don't advance on failure — the grade wasn't saved.
        notify(`[ERROR: ${e instanceof Error ? e.message : "save failed"}]`);
        return;
      } finally {
        setSaving(false);
      }
      setCounts((c) => ({ ...c, [GRADE_KEY[g]]: c[GRADE_KEY[g]] + 1 }));
      setQueue((q) => {
        const [head, ...rest] = q;
        // Again: requeue this card to the end of the session; else finish it.
        return g === Grade.Again ? [...rest, head] : rest;
      });
      if (g !== Grade.Again) setFinished((f) => f + 1);
    },
    [current, id, saving, notify],
  );

  // Keyboard: Space = reveal, 1-4 = grade. Ignore while typing in chat.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (!current) return;
      if (e.code === "Space" && !revealed) {
        e.preventDefault();
        setRevealed(true);
      } else if (revealed && !saving && ["1", "2", "3", "4"].includes(e.key)) {
        grade((Number(e.key) - 1) as Grade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, saving, current, grade]);

  if (total === 0) {
    return <Empty line="Nothing due. Inbox zero." id={id} />;
  }
  if (!current) {
    return (
      <Summary
        id={id}
        total={total}
        counts={counts}
        elapsedMs={Date.now() - startedAt}
      />
    );
  }

  const level = Math.min(3, Math.max(1, current.level));
  const coverage = checked.filter(Boolean).length;
  const pct = Math.round((finished / total) * 100);

  return (
    <div className="space-y-8">
      {/* progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>
            {current.title} · L{level}
          </Label>
          <Label>
            {finished} / {total}
          </Label>
        </div>
        <div className="h-1.5 rounded-[2px] bg-border overflow-hidden">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="min-h-[34vh] space-y-6">
        <p className="font-grotesk text-display text-[20px] leading-snug">
          {current.title}
        </p>
        <Label className="!text-accent">{levelHint[level]}</Label>

        {level <= 2 && current.summary && (
          <div className="space-y-1">
            <Label>Gist</Label>
            <p className="text-secondary text-[15px] leading-relaxed">
              {current.summary}
            </p>
          </div>
        )}
        {level === 1 && current.keyPoints.length > 0 && (
          <div className="space-y-1.5">
            <Label>Key points</Label>
            <ul className="space-y-1.5">
              {current.keyPoints.map((kp, i) => (
                <li key={i} className="flex gap-2 text-primary text-[15px]">
                  <span className="text-accent shrink-0">—</span>
                  <span>{kp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {revealed && (
          <div className="space-y-5 pt-2 border-t border-border">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Did you cover these?</Label>
                <Label>
                  {coverage}/{current.keyPoints.length}
                </Label>
              </div>
              <ul className="space-y-1.5">
                {current.keyPoints.map((kp, i) => (
                  <li key={i}>
                    <button
                      onClick={() =>
                        setChecked((c) => c.map((v, j) => (j === i ? !v : v)))
                      }
                      className="flex gap-2 text-left text-[15px] w-full hover:text-primary"
                    >
                      <span className={checked[i] ? "text-success" : "text-disabled"}>
                        {checked[i] ? "☑" : "☐"}
                      </span>
                      <span className={checked[i] ? "text-primary" : "text-secondary"}>
                        {kp}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <Label className="!text-success">Optimized</Label>
                <button
                  onClick={() => speak(current.optimized)}
                  className="label hover:text-primary"
                  aria-label="Read optimized aloud"
                >
                  🔊 LISTEN
                </button>
              </div>
              <Markdown>{current.optimized}</Markdown>
            </div>
            <div className="space-y-1">
              <Label>Your original</Label>
              <p className="font-grotesk text-secondary text-[15px] leading-[1.6] whitespace-pre-wrap">
                {current.text}
              </p>
            </div>
          </div>
        )}
      </div>

      {!revealed ? (
        <Button
          variant="primary"
          className="w-full py-4"
          onClick={() => setRevealed(true)}
        >
          Reveal →{"  "}
          <span className="opacity-60 ml-2">[space]</span>
        </Button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((g, i) => (
            <Button
              key={g.grade}
              variant={g.variant}
              disabled={saving}
              onClick={() => grade(g.grade)}
            >
              {i + 1} {g.label}
            </Button>
          ))}
        </div>
      )}

      <SectionChat
        presentationId={id}
        sectionIndex={current.index}
        section={{
          title: current.title,
          optimized: current.optimized,
          text: current.text,
          keyPoints: current.keyPoints,
        }}
      />
    </div>
  );
}

function Summary({
  id,
  total,
  counts,
  elapsedMs,
}: {
  id: string;
  total: number;
  counts: { again: number; hard: number; good: number; easy: number };
  elapsedMs: number;
}) {
  const mins = Math.floor(elapsedMs / 60000);
  const secs = Math.floor((elapsedMs % 60000) / 1000);
  const time = `${mins}:${String(secs).padStart(2, "0")}`;
  const rows: [string, number, string][] = [
    ["Easy", counts.easy, "text-success"],
    ["Good", counts.good, "text-primary"],
    ["Hard", counts.hard, "text-warning"],
    ["Again", counts.again, "text-accent"],
  ];

  return (
    <div className="space-y-10 py-10">
      <div className="text-center space-y-3">
        <p className="font-mono text-display text-[20px] tracking-[0.06em]">
          [ SESSION COMPLETE ]
        </p>
        <div className="flex justify-center gap-8 pt-4">
          <Stat value={String(total)} label="sections" />
          <Stat value={time} label="time" />
        </div>
      </div>

      <div className="max-w-xs mx-auto space-y-2">
        <Label>Grades</Label>
        {rows.map(([label, n, color]) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-border py-2"
          >
            <span className={`label ${color}`}>{label}</span>
            <span className="font-mono text-primary text-[15px]">{n}</span>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <Link href={`/presentation/${id}`}>
          <Button variant="outline">Back to plan</Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="font-mono text-display text-[32px] leading-none">
        {value}
      </span>
      <Label>{label}</Label>
    </div>
  );
}

function Empty({ line, id }: { line: string; id: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <p className="font-mono text-display text-[20px] tracking-[0.06em]">
        {line}
      </p>
      <Link href={`/presentation/${id}`}>
        <Button variant="outline">Back to plan</Button>
      </Link>
    </div>
  );
}
