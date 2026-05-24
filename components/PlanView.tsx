import Link from "next/link";
import type { PresentationRecord } from "@/lib/store/types";
import { Button, Label } from "@/components/nothing";
import { PresentationActions } from "@/components/PresentationActions";
import { SectionBoard, type SectionView } from "@/components/SectionBoard";

export function PlanView({
  record,
  dueCount,
}: {
  record: PresentationRecord;
  dueCount: number;
}) {
  const { plan } = record;
  const now = Date.now();

  // Per-section view data: merge content with its practice card (level + due).
  const byIndex = new Map(record.practice.map((p) => [p.segmentIndex, p]));
  const sections: SectionView[] = plan.sections.map((sec, i) => {
    const card = byIndex.get(i);
    return {
      index: i,
      title: sec.title,
      difficulty: sec.difficulty,
      summary: sec.summary,
      keyPoints: sec.keyPoints,
      optimized: sec.optimized,
      text: sec.text,
      level: card?.masteryLevel ?? 1,
      due: card ? new Date(card.dueAt).getTime() <= now : true,
    };
  });

  return (
    <div className="space-y-14">
      {/* Hero: title + due metric + enter-focus CTA */}
      <section className="space-y-6">
        <Label>{record.sourceType.toUpperCase()} · plan</Label>
        <h1 className="font-grotesk font-light text-display text-[clamp(1.8rem,5vw,2.75rem)] leading-[1.05] tracking-[-0.02em]">
          {record.title}
        </h1>
        <PresentationActions id={record.id} title={record.title} />
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

      <SectionBoard id={record.id} sections={sections} />
    </div>
  );
}
