import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PracticeSession, type DueSection } from "@/components/PracticeSession";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";

// Next.js 16: route params are async and must be awaited.
export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sections?: string }>;
}) {
  const { id } = await params;
  const { sections: sel } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const record = user ? await supabaseStore.get(id, user.id) : null;
  if (!record) notFound();

  const now = Date.now();
  let cards;
  if (sel) {
    // Explicit selection from the detail page — practice exactly these sections.
    const picked = new Set(
      sel.split(",").map(Number).filter(Number.isInteger),
    );
    cards = record.practice.filter((p) => picked.has(p.segmentIndex));
  } else {
    const due = record.practice.filter(
      (p) => new Date(p.dueAt).getTime() <= now,
    );
    // If nothing is due, allow practicing the whole deck ("Practice anyway").
    cards = due.length ? due : record.practice;
  }

  const sections: DueSection[] = cards
    .map((p) => {
      const sec = record.plan.sections[p.segmentIndex];
      return sec
        ? {
            index: p.segmentIndex,
            title: sec.title,
            summary: sec.summary,
            keyPoints: sec.keyPoints,
            text: sec.text,
            optimized: sec.optimized,
            level: p.masteryLevel,
          }
        : null;
    })
    .filter((s): s is DueSection => s !== null);

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl px-6 md:px-10 py-12 md:py-16">
        <PracticeSession id={id} sections={sections} />
      </main>
    </>
  );
}
