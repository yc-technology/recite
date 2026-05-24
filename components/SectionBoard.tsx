"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Label } from "@/components/nothing";
import { Markdown } from "@/components/Markdown";

export type SectionView = {
  index: number;
  title: string;
  difficulty: string;
  summary: string;
  keyPoints: string[];
  optimized: string;
  text: string;
  level: number; // mastery level 1..3
  due: boolean;
};

const difficultyColor: Record<string, string> = {
  easy: "text-success",
  medium: "text-warning",
  hard: "text-accent",
};
const levelColor: Record<number, string> = {
  1: "text-secondary",
  2: "text-warning",
  3: "text-success",
};
const levelBar: Record<number, string> = {
  1: "bg-border-strong",
  2: "bg-warning",
  3: "bg-success",
};

export function SectionBoard({
  id,
  sections,
}: {
  id: string;
  sections: SectionView[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }
  const allSelected = selected.size === sections.length && sections.length > 0;
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(sections.map((s) => s.index)));
  }
  function practiceSelected() {
    const idxs = [...selected].sort((a, b) => a - b);
    router.push(`/practice/${id}?sections=${idxs.join(",")}`);
  }

  const mastered = sections.filter((s) => s.level >= 3).length;
  const dueCount = sections.filter((s) => s.due).length;

  return (
    <>
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <Label>Sections — {sections.length}</Label>
          <button onClick={toggleAll} className="label hover:text-primary">
            {allSelected ? "CLEAR" : "SELECT ALL"}
          </button>
        </div>

        <ol className="space-y-3">
          {sections.map((sec) => {
            const isSel = selected.has(sec.index);
            return (
              <Card
                key={sec.index}
                className={`space-y-3 ${isSel ? "border-primary" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggle(sec.index)}
                    className={`shrink-0 text-[16px] ${isSel ? "text-accent" : "text-disabled hover:text-primary"}`}
                    aria-label="Select section"
                  >
                    {isSel ? "☑" : "☐"}
                  </button>
                  <span className="font-mono text-secondary text-[13px] w-7 shrink-0">
                    {String(sec.index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-grotesk font-medium text-primary text-[18px] flex-1">
                    {sec.title}
                  </h3>
                  {sec.due && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  )}
                  <span className={`label ${levelColor[sec.level] ?? "text-secondary"}`}>
                    L{sec.level}
                  </span>
                  <span
                    className={`label ${difficultyColor[sec.difficulty] ?? "text-secondary"}`}
                  >
                    {sec.difficulty}
                  </span>
                </div>

                {sec.summary && (
                  <p className="text-secondary text-[14px] leading-relaxed pl-10">
                    {sec.summary}
                  </p>
                )}
                {sec.keyPoints.length > 0 && (
                  <ul className="pl-10 space-y-1.5">
                    {sec.keyPoints.map((kp, ki) => (
                      <li
                        key={ki}
                        className="flex gap-2 text-primary text-[14px] leading-snug"
                      >
                        <span className="text-accent shrink-0">—</span>
                        <span>{kp}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="pl-10 space-y-2">
                  <Label className="!text-success">Optimized</Label>
                  <Markdown>{sec.optimized}</Markdown>
                </div>

                <details className="pl-10">
                  <summary className="label cursor-pointer hover:text-primary list-none">
                    ▸ Original
                  </summary>
                  <p className="mt-2 text-secondary text-[13px] font-mono leading-relaxed whitespace-pre-wrap">
                    {sec.text}
                  </p>
                </details>

                <div className="pl-10">
                  <button
                    onClick={() =>
                      router.push(`/practice/${id}?sections=${sec.index}`)
                    }
                    className="label hover:text-primary"
                  >
                    ▶ PRACTICE THIS
                  </button>
                </div>
              </Card>
            );
          })}
        </ol>
      </section>

      {/* Progress */}
      <section className="space-y-4">
        <Label>Progress</Label>
        <div className="flex gap-1">
          {sections.map((s) => (
            <div
              key={s.index}
              title={`${s.title} — L${s.level}`}
              className={`flex-1 h-2 rounded-[2px] ${levelBar[s.level] ?? "bg-border-strong"}`}
            />
          ))}
        </div>
        <div className="flex gap-8">
          <Stat value={`${mastered}/${sections.length}`} label="mastered (L3)" />
          <Stat value={String(dueCount)} label="due now" />
          <Stat
            value={`${Math.round(
              (sections.reduce((s, x) => s + (x.level - 1), 0) /
                (sections.length * 2 || 1)) *
                100,
            )}%`}
            label="overall"
          />
        </div>
      </section>

      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 flex justify-center">
          <Button variant="primary" className="px-8 py-4" onClick={practiceSelected}>
            Practice {selected.size} selected →
          </Button>
        </div>
      )}
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-display text-[22px] leading-none">
        {value}
      </span>
      <Label>{label}</Label>
    </div>
  );
}
