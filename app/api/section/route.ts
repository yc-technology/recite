import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateSection } from "@/lib/agent/addSection";
import { OptimizeStyleSchema, SectionSchema } from "@/lib/agent/schema";
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
  rawText: z.string().trim().min(1).max(20000),
  style: OptimizeStyleSchema.optional(),
});

// POST = generate a candidate section (no DB write).
export async function POST(req: NextRequest) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isLlmAllowed(user.email)) {
    return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }
  if (!(await rateLimit(user.id, "section", 30, 600))) {
    return NextResponse.json({ error: "rate limited — try again later" }, { status: 429 });
  }

  const parsed = GenBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { presentationId, rawText, style } = parsed.data;

  // Ownership: you may only add to your own presentation.
  const rec = await supabaseStore.get(presentationId, user.id);
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const section = await generateSection(rawText, style ?? "simple");
    return NextResponse.json({ section });
  } catch (e) {
    console.error("generate section failed:", e);
    return NextResponse.json({ error: "generate failed" }, { status: 502 });
  }
}

const InsertBody = z.object({
  presentationId: z.string().min(1),
  position: z.number().int().nonnegative(),
  section: SectionSchema,
});

// PUT = insert the chosen candidate at a position (no LLM call).
export async function PUT(req: NextRequest) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = InsertBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { presentationId, position, section } = parsed.data;

  const rec = await supabaseStore.get(presentationId, user.id);
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Clamp to [0, length]; the store/RPC persists the shift. position is already
  // a non-negative int (zod), so a single Math.min is enough.
  const clamped = Math.min(position, rec.plan.sections.length);

  try {
    await supabaseStore.addSection(presentationId, user.id, clamped, section);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("insert section failed:", e);
    return NextResponse.json({ error: "save failed" }, { status: 502 });
  }
}
