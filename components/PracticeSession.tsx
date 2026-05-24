"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Grade } from "@/lib/srs/sm2";
import { Button, Label } from "@/components/nothing";
import { Markdown } from "@/components/Markdown";

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
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);

  const current = sections[pos];

  useEffect(() => {
    setChecked(current ? current.keyPoints.map(() => false) : []);
    setRevealed(false);
  }, [current]);

  const coverage = useMemo(
    () => checked.filter(Boolean).length,
    [checked],
  );

  if (sections.length === 0) {
    return <Empty line="Nothing due. Inbox zero." id={id} />;
  }
  if (pos >= sections.length) {
    return <Empty line="[ SESSION COMPLETE ]" id={id} />;
  }

  async function grade(g: Grade) {
    setSaving(true);
    try {
      await fetch("/api/practice-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, segmentIndex: current.index, grade: g }),
      });
    } finally {
      setSaving(false);
      setPos((p) => p + 1);
    }
  }

  const level = Math.min(3, Math.max(1, current.level));

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <Label>
          {current.title} · L{level}
        </Label>
        <Label>
          {String(pos + 1).padStart(2, "0")} /{" "}
          {String(sections.length).padStart(2, "0")}
        </Label>
      </div>

      <div className="min-h-[38vh] space-y-6">
        {/* Scaffold — fades as mastery level rises */}
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

        {/* Reveal — checklist self-assessment + original for comparison */}
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
                        setChecked((c) =>
                          c.map((v, j) => (j === i ? !v : v)),
                        )
                      }
                      className="flex gap-2 text-left text-[15px] w-full hover:text-primary"
                    >
                      <span
                        className={
                          checked[i] ? "text-success" : "text-disabled"
                        }
                      >
                        {checked[i] ? "☑" : "☐"}
                      </span>
                      <span
                        className={checked[i] ? "text-primary" : "text-secondary"}
                      >
                        {kp}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1">
              <Label className="!text-success">Optimized</Label>
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
          Reveal →
        </Button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <Button
              key={g.grade}
              variant={g.variant}
              disabled={saving}
              onClick={() => grade(g.grade)}
            >
              {g.label}
            </Button>
          ))}
        </div>
      )}
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
