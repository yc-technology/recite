import Link from "next/link";
import type { PresentationRecord } from "@/lib/store/types";
import { Button, Card, Label } from "@/components/nothing";

const difficultyColor: Record<string, string> = {
  easy: "text-success",
  medium: "text-warning",
  hard: "text-accent",
};

function DueCount({ due, total }: { due: number; total: number }) {
  return (
    <div className="flex items-end gap-3">
      <span className="font-mono text-display text-[clamp(3rem,12vw,6rem)] leading-[0.9] tracking-[-0.03em]">
        {due}
      </span>
      <Label className="pb-3">/ {total} due now</Label>
    </div>
  );
}

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
          <DueCount due={dueCount} total={plan.segments.length} />
          <Link href={`/practice/${record.id}`}>
            <Button variant="primary" className="px-8 py-4">
              {dueCount > 0 ? "Enter focus →" : "Practice anyway →"}
            </Button>
          </Link>
        </div>
      </section>

      {/* Segments */}
      <section className="space-y-5">
        <Label>Segments — {plan.segments.length}</Label>
        <ol className="space-y-3">
          {plan.segments.map((seg, i) => (
            <Card key={i} className="flex gap-5">
              <span className="font-mono text-secondary text-[13px] pt-1 w-8 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-3">
                  <h3 className="font-grotesk font-medium text-primary text-[18px]">
                    {seg.title}
                  </h3>
                  <span
                    className={`label ${difficultyColor[seg.difficulty] ?? "text-secondary"}`}
                  >
                    {seg.difficulty}
                  </span>
                </div>
                <p className="text-secondary text-[14px] leading-relaxed line-clamp-3">
                  {seg.content}
                </p>
                {seg.hints.length > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    {seg.hints.map((h, hi) => (
                      <Label key={hi} className="!text-disabled">
                        · {h}
                      </Label>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </ol>
      </section>

      {/* Schedule */}
      {plan.dailySchedule.length > 0 && (
        <section className="space-y-5">
          <Label>Schedule</Label>
          <div className="space-y-2">
            {plan.dailySchedule.map((task, i) => (
              <div
                key={i}
                className="flex items-baseline gap-5 border-b border-border py-3"
              >
                <span className="font-mono text-display text-[15px] w-16 shrink-0">
                  DAY {task.dayIndex + 1}
                </span>
                <span
                  className={`label ${task.taskType === "review" ? "text-interactive" : "text-primary"}`}
                >
                  {task.taskType}
                </span>
                <span className="text-secondary text-[14px] font-mono">
                  {task.segmentIndexes
                    .map((s) => String(s + 1).padStart(2, "0"))
                    .join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
