"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { maskSentences } from "@/lib/cloze";
import { Grade } from "@/lib/srs/sm2";
import { Button, Label } from "@/components/nothing";

export type DueSegment = { index: number; title: string; content: string };

const GRADES: { grade: Grade; label: string; variant: "outline" | "primary" }[] =
  [
    { grade: Grade.Again, label: "Again", variant: "outline" },
    { grade: Grade.Hard, label: "Hard", variant: "outline" },
    { grade: Grade.Good, label: "Good", variant: "outline" },
    { grade: Grade.Easy, label: "Easy", variant: "primary" },
  ];

export function PracticeSession({
  id,
  segments,
}: {
  id: string;
  segments: DueSegment[];
}) {
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = segments[pos];
  const cloze = useMemo(
    () => (current ? maskSentences(current.content) : []),
    [current],
  );

  if (segments.length === 0) {
    return (
      <Empty
        line="Nothing due. Inbox zero."
        href={`/presentation/${id}`}
        cta="Back to plan"
      />
    );
  }

  if (pos >= segments.length) {
    return (
      <Empty
        line="[ SESSION COMPLETE ]"
        href={`/presentation/${id}`}
        cta="Back to plan"
      />
    );
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
      setRevealed(false);
      setPos((p) => p + 1);
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <Label>{current.title}</Label>
        <Label>
          {String(pos + 1).padStart(2, "0")} / {String(segments.length).padStart(2, "0")}
        </Label>
      </div>

      <div className="min-h-[40vh]">
        {!revealed ? (
          <div className="space-y-4">
            <Label className="!text-accent">Recall from memory</Label>
            <div className="space-y-3">
              {cloze.map((c, i) => (
                <div
                  key={i}
                  className="font-mono text-display text-[22px] tracking-[0.1em]"
                >
                  {c.masked}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Label>Original</Label>
            <p className="font-grotesk text-primary text-[20px] leading-[1.6]">
              {current.content}
            </p>
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

function Empty({
  line,
  href,
  cta,
}: {
  line: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
      <p className="font-mono text-display text-[20px] tracking-[0.06em]">
        {line}
      </p>
      <Link href={href}>
        <Button variant="outline">{cta}</Button>
      </Link>
    </div>
  );
}
