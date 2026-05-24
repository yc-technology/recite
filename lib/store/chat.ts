import { createClient } from "@/lib/supabase/server";

export type StoredMsg = { role: "user" | "assistant"; content: string };

// Chat persistence is kept separate from the presentation Store: it's a
// distinct concern with its own table. RLS scopes every row to the owner.
export async function listChat(
  presentationId: string,
  sectionIndex: number,
): Promise<StoredMsg[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("presentation_id", presentationId)
    .eq("segment_index", sectionIndex)
    .order("created_at", { ascending: true });
  return (data ?? []).map((m) => ({
    role: m.role as StoredMsg["role"],
    content: m.content as string,
  }));
}

export async function appendChat(
  presentationId: string,
  userId: string,
  sectionIndex: number,
  msgs: StoredMsg[],
): Promise<void> {
  if (!msgs.length) return;
  const supabase = await createClient();
  const rows = msgs.map((m) => ({
    user_id: userId,
    presentation_id: presentationId,
    segment_index: sectionIndex,
    role: m.role,
    content: m.content,
  }));
  await supabase.from("chat_messages").insert(rows);
}
