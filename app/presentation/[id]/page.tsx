import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { PlanView } from "@/components/PlanView";
import { memoryStore } from "@/lib/store/memory";

// Next.js 16: route params are async and must be awaited.
export default async function PresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await memoryStore.get(id, "local");
  if (!record) notFound();

  const now = Date.now();
  const dueCount = record.practice.filter(
    (p) => new Date(p.dueAt).getTime() <= now,
  ).length;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-6 md:px-10 py-12 md:py-16">
        <PlanView record={record} dueCount={dueCount} />
      </main>
    </>
  );
}
