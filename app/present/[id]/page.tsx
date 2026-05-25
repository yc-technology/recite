import { notFound } from "next/navigation";
import { Teleprompter } from "@/components/Teleprompter";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";

// Next.js 16: route params are async and must be awaited.
export default async function PresentPage({
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

  return (
    <Teleprompter
      id={record.id}
      title={record.title}
      sections={record.plan.sections}
    />
  );
}
