import { NextRequest, NextResponse } from "next/server";
import { review, Grade } from "@/lib/srs/sm2";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, segmentIndex, grade } = await req.json();
  const rec = await supabaseStore.get(id, user.id);
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });
  const now = new Date();
  const practice = rec.practice.map((p) =>
    p.segmentIndex === segmentIndex
      ? { ...review(p, grade as Grade, now), segmentIndex }
      : p
  );
  await supabaseStore.updatePractice(id, user.id, practice);
  return NextResponse.json({ ok: true });
}
