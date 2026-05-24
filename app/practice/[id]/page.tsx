import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PracticeSession, type DueSegment } from "@/components/PracticeSession";
import { memoryStore } from "@/lib/store/memory";

// Next.js 16: route params are async and must be awaited.
export default async function PracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await memoryStore.get(id, "local");
  if (!record) notFound();

  const now = Date.now();
  const dueIndexes = record.practice
    .filter((p) => new Date(p.dueAt).getTime() <= now)
    .map((p) => p.segmentIndex);

  // If nothing is due, allow practicing the whole deck ("Practice anyway").
  const indexes = dueIndexes.length
    ? dueIndexes
    : record.practice.map((p) => p.segmentIndex);

  const segments: DueSegment[] = indexes
    .map((index) => {
      const seg = record.plan.segments[index];
      return seg ? { index, title: seg.title, content: seg.content } : null;
    })
    .filter((s): s is DueSegment => s !== null);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl px-6 md:px-10 py-12 md:py-16">
        <PracticeSession id={id} segments={segments} />
      </main>
    </>
  );
}
