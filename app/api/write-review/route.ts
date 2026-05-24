import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reviewWriting } from "@/lib/agent/write";
import { OptimizeStyleSchema } from "@/lib/agent/schema";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";
import { isLlmAllowed } from "@/lib/allowlist";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(1).max(8000),
  style: OptimizeStyleSchema.default("native"),
  goal: z.string().max(80).default("general"),
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
  if (!(await rateLimit(user.id, "write-review", 20, 600))) {
    return NextResponse.json({ error: "rate limited — try again later" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  try {
    const review = await reviewWriting(parsed.data.text, {
      style: parsed.data.style,
      goal: parsed.data.goal,
    });
    return NextResponse.json(review);
  } catch (e) {
    console.error("write-review failed:", e);
    return NextResponse.json({ error: "review failed" }, { status: 502 });
  }
}
