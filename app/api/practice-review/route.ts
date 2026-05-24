import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { review, Grade } from "@/lib/srs/sm2";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";

// Validate strictly: an out-of-range grade would make review() produce NaN
// ease/interval and silently corrupt the persisted schedule.
const ReviewSchema = z.object({
  id: z.string().min(1),
  segmentIndex: z.number().int().nonnegative(),
  grade: z.nativeEnum(Grade),
});

// Scaffold level moves independently of the SM-2 interval: good recall removes
// hints, a lapse adds them back. Clamped to 1..3.
function nextLevel(level: number, grade: Grade): number {
  if (grade === Grade.Again) return Math.max(1, level - 1);
  if (grade === Grade.Good || grade === Grade.Easy) return Math.min(3, level + 1);
  return level; // Hard: hold
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = ReviewSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { id, segmentIndex, grade } = parsed.data;

  const rec = await supabaseStore.get(id, user.id);
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });

  const now = new Date();
  const practice = rec.practice.map((p) =>
    p.segmentIndex === segmentIndex
      ? {
          ...review(p, grade, now),
          segmentIndex,
          masteryLevel: nextLevel(p.masteryLevel, grade),
        }
      : p,
  );
  await supabaseStore.updatePractice(id, user.id, practice);
  return NextResponse.json({ ok: true });
}
