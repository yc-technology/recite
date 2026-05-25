"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, List, Play, X } from "lucide-react";
import { Card, Label } from "@/components/nothing";
import { SectionRefine } from "@/components/SectionRefine";

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
  const [navOpen, setNavOpen] = useState(false);

  function jumpTo(i: number) {
    setNavOpen(false);
    document
      .getElementById(`sec-${i}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const mastered = sections.filter((s) => s.level >= 3).length;
  const dueCount = sections.filter((s) => s.due).length;
  const pct = Math.round(
    (sections.reduce((s, x) => s + (x.level - 1), 0) /
      (sections.length * 2 || 1)) *
      100,
  );

  return (
    <>
      {/* Progress — sticks to the top while scrolling through sections */}
      <div className="sticky top-0 z-30 -mx-6 md:-mx-10 px-6 md:px-10 py-3 bg-bg border-b border-border space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label>Progress</Label>
          <Label>
            {mastered}/{sections.length} mastered · {dueCount} due · {pct}%
          </Label>
        </div>
        <div className="flex gap-1">
          {sections.map((s) => (
            <div
              key={s.index}
              title={`${s.title} — L${s.level}`}
              className={`flex-1 h-1.5 rounded-[2px] ${levelBar[s.level] ?? "bg-border-strong"}`}
            />
          ))}
        </div>
      </div>

      <section className="space-y-5">
        <Label>Sections — {sections.length}</Label>

        <ol className="space-y-3">
          {sections.map((sec) => {
            return (
              <Card
                key={sec.index}
                id={`sec-${sec.index}`}
                className="space-y-3 scroll-mt-6"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-secondary text-label w-7 shrink-0">
                    {String(sec.index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-grotesk font-medium text-primary text-title flex-1">
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
                  <p className="text-secondary text-body leading-relaxed">
                    {sec.summary}
                  </p>
                )}
                {sec.keyPoints.length > 0 && (
                  <ul className="space-y-1.5">
                    {sec.keyPoints.map((kp, ki) => (
                      <li
                        key={ki}
                        className="flex gap-2 text-primary text-body leading-snug"
                      >
                        <span className="text-accent shrink-0">—</span>
                        <span>{kp}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <SectionRefine
                  presentationId={id}
                  sectionIndex={sec.index}
                  optimized={sec.optimized}
                />

                <details className="group">
                  <summary className="label cursor-pointer hover:text-primary list-none flex items-center gap-1.5">
                    <ChevronRight
                      size={13}
                      className="transition-transform group-open:rotate-90"
                    />
                    Original
                  </summary>
                  <p className="mt-2 text-secondary text-label font-mono leading-relaxed whitespace-pre-wrap">
                    {sec.text}
                  </p>
                </details>

                <div>
                  <button
                    onClick={() =>
                      router.push(`/practice/${id}?sections=${sec.index}`)
                    }
                    className="label hover:text-primary flex items-center gap-1.5"
                  >
                    <Play size={13} />
                    PRACTICE THIS
                  </button>
                </div>
              </Card>
            );
          })}
        </ol>
      </section>

      {/* Floating section navigator — jump to any section from anywhere */}
      {navOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setNavOpen(false)}
          />
          <div className="fixed bottom-24 right-6 z-40 w-64 max-h-[60vh] overflow-auto bg-surface border border-border-strong rounded-[8px] p-2">
            <div className="px-3 py-2 border-b border-border">
              <Label>Jump to section</Label>
            </div>
            {sections.map((s) => (
              <button
                key={s.index}
                onClick={() => jumpTo(s.index)}
                className="w-full flex items-center gap-3 text-left px-3 py-2 hover:bg-surface-raised rounded-[4px]"
              >
                <span className="font-mono text-secondary text-caption w-6 shrink-0">
                  {String(s.index + 1).padStart(2, "0")}
                </span>
                <span className="text-primary text-label truncate flex-1">
                  {s.title}
                </span>
                {s.due && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
      <button
        onClick={() => setNavOpen((o) => !o)}
        aria-label="Section navigator"
        className="fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center hover:opacity-90"
      >
        {navOpen ? <X size={20} /> : <List size={20} />}
      </button>
    </>
  );
}
