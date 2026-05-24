import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeSections } from "@/lib/agent/analyze";
import { initialCard } from "@/lib/srs/sm2";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";
import type { PracticeState } from "@/lib/store/types";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  title: z.string().min(1),
  sourceType: z.string().min(1),
  sections: z
    .array(z.object({ title: z.string(), text: z.string().min(1) }))
    .min(1),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { title, sourceType, sections } = parsed.data;

  const plan = await analyzeSections(sections);
  const now = new Date();
  const practice: PracticeState[] = plan.sections.map((_, i) => ({
    ...initialCard(now),
    segmentIndex: i,
    masteryLevel: 1,
  }));
  const rawText = sections.map((s) => s.text).join("\n\n");

  const rec = await supabaseStore.create({
    userId: user.id,
    title,
    rawText,
    sourceType,
    plan,
    practice,
  });
  return NextResponse.json({ id: rec.id });
}
