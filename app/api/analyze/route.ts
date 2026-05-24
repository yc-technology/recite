import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeSections } from "@/lib/agent/analyze";
import { OptimizeStyleSchema } from "@/lib/agent/schema";
import { rateLimit } from "@/lib/ratelimit";
import { isLlmAllowed } from "@/lib/allowlist";
import { initialCard } from "@/lib/srs/sm2";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";
import type { PracticeState } from "@/lib/store/types";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  title: z.string().min(1),
  sourceType: z.string().min(1),
  style: OptimizeStyleSchema.default("simple"),
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
  if (!isLlmAllowed(user.email)) {
    return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }
  if (!(await rateLimit(user.id, "analyze", 20, 600))) {
    return NextResponse.json({ error: "rate limited — try again later" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { title, sourceType, style, sections } = parsed.data;

  try {
    const plan = await analyzeSections(sections, style);
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
  } catch (e) {
    console.error("analyze failed:", e);
    return NextResponse.json({ error: "analysis failed" }, { status: 502 });
  }
}
