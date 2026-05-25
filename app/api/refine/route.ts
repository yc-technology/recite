import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { refineOptimized } from "@/lib/agent/refine";
import { rateLimit } from "@/lib/ratelimit";
import { isLlmAllowed } from "@/lib/allowlist";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const GenBody = z.object({
  presentationId: z.string().min(1),
  sectionIndex: z.number().int().nonnegative(),
  instruction: z.string().min(1).max(500),
});

// POST = generate a candidate (no DB write).
export async function POST(req: NextRequest) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isLlmAllowed(user.email)) {
    return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }
  if (!(await rateLimit(user.id, "refine", 30, 600))) {
    return NextResponse.json({ error: "rate limited — try again later" }, { status: 429 });
  }

  const parsed = GenBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { presentationId, sectionIndex, instruction } = parsed.data;

  const rec = await supabaseStore.get(presentationId, user.id);
  const section = rec?.plan.sections[sectionIndex];
  if (!rec || !section) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const optimized = await refineOptimized(section.title, section.optimized, instruction);
    if (!optimized) throw new Error("empty result");
    return NextResponse.json({ optimized });
  } catch (e) {
    console.error("refine failed:", e);
    return NextResponse.json({ error: "refine failed" }, { status: 502 });
  }
}

const AcceptBody = z.object({
  presentationId: z.string().min(1),
  sectionIndex: z.number().int().nonnegative(),
  optimized: z.string().min(1).max(10000),
});

// PUT = accept/persist the chosen candidate (no LLM call).
export async function PUT(req: NextRequest) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = AcceptBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { presentationId, sectionIndex, optimized } = parsed.data;

  const rec = await supabaseStore.get(presentationId, user.id);
  if (!rec || !rec.plan.sections[sectionIndex]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    await supabaseStore.updateOptimized(presentationId, user.id, sectionIndex, optimized);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("accept refine failed:", e);
    return NextResponse.json({ error: "save failed" }, { status: 502 });
  }
}
