import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizePresentation } from "@/lib/agent/normalize";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ rawText: z.string().min(1) });

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
  const normalized = await normalizePresentation(parsed.data.rawText);
  return NextResponse.json(normalized); // { sections: [{ title, text }] }
}
