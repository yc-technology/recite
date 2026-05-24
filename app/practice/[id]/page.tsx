import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PracticeSession, type DueSection } from "@/components/PracticeSession";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";

// Next.js 16: route params are async and must be awaited.
export default async function PracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const record = user ? await supabaseStore.get(id, user.id) : null;
  if (!record) notFound();

  const now = Date.now();
  const due = record.practice.filter(
    (p) => new Date(p.dueAt).getTime() <= now,
  );
  // If nothing is due, allow practicing the whole deck ("Practice anyway").
  const cards = due.length ? due : record.practice;

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
