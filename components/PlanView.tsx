import Link from "next/link";
import type { PresentationRecord } from "@/lib/store/types";
import { Button, Card, Label } from "@/components/nothing";

const difficultyColor: Record<string, string> = {
  easy: "text-success",
  medium: "text-warning",
  hard: "text-accent",
};

export function PlanView({
  record,
  dueCount,
}: {
  record: PresentationRecord;
  dueCount: number;
}) {
  const { plan } = record;

  return (
    <div className="space-y-14">
      {/* Hero: title + due metric + enter-focus CTA */}
      <section className="space-y-6">
        <Label>{record.sourceType.toUpperCase()} · plan</Label>
        <h1 className="font-grotesk font-light text-display text-[clamp(1.8rem,5vw,2.75rem)] leading-[1.05] tracking-[-0.02em]">
          {record.title}
        </h1>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex items-end gap-3">
            <span className="font-mono text-display text-[clamp(3rem,12vw,6rem)] leading-[0.9] tracking-[-0.03em]">
              {dueCount}
            </span>
            <Label className="pb-3">/ {plan.sections.length} due now</Label>
          </div>
          <Link href={`/practice/${record.id}`}>
            <Button variant="primary" className="px-8 py-4">
              {dueCount > 0 ? "Enter focus →" : "Practice anyway →"}
            </Button>
          </Link>
        </div>
      </section>

      {/* Sections: summary + key points, original collapsed for reference */}
      <section className="space-y-5">
        <Label>Sections — {plan.sections.length}</Label>
        <ol className="space-y-3">
          {plan.sections.map((sec, i) => (
            <Card key={i} className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-secondary text-[13px] w-8 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="font-grotesk font-medium text-primary text-[18px] flex-1">
                  {sec.title}
                </h3>
                <span
                  className={`label ${difficultyColor[sec.difficulty] ?? "text-secondary"}`}
                >
                  {sec.difficulty}
                </span>
              </div>

              {sec.summary && (
                <p className="text-secondary text-[14px] leading-relaxed pl-11">
                  {sec.summary}
                </p>
              )}

              {sec.keyPoints.length > 0 && (
                <ul className="pl-11 space-y-1.5">
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

              <details className="pl-11 group">
                <summary className="label cursor-pointer hover:text-primary list-none">
                  ▸ Original
                </summary>
                <p className="mt-2 text-secondary text-[13px] font-mono leading-relaxed whitespace-pre-wrap">
                  {sec.text}
                </p>
              </details>
            </Card>
          ))}
        </ol>
      </section>
    </div>
  );
}
