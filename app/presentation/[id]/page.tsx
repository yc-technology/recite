import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PlanView } from "@/components/PlanView";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";

// Next.js 16: route params are async and must be awaited.
export default async function PresentationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const record = user ? await supabaseStore.get(id, user.id) : null;
  if (!record) notFound();

  const now = Date.now();
  const dueCount = record.practice.filter(
    (p) => new Date(p.dueAt).getTime() <= now,
  ).length;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-6 md:px-10 py-12 md:py-16">
        <Breadcrumb
          items={[{ label: "Dashboard", href: "/" }, { label: record.title }]}
        />
        <PlanView record={record} dueCount={dueCount} />
      </main>
    </>
  );
}
