import { NextRequest, NextResponse } from "next/server";
import { analyzePresentation } from "@/lib/agent/analyze";
import { initialCard } from "@/lib/srs/sm2";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";
import type { PracticeState } from "@/lib/store/types";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { rawText, title, sourceType } = await req.json();
  if (!rawText) return NextResponse.json({ error: "no text" }, { status: 400 });
  const plan = await analyzePresentation(rawText);
  const now = new Date();
  const practice: PracticeState[] = plan.segments.map((_, i) => ({
    ...initialCard(now), segmentIndex: i,
  }));
  const rec = await supabaseStore.create({
    userId: user.id, title, rawText, sourceType, plan, practice,
  });
  return NextResponse.json({ id: rec.id });
}
