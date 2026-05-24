import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { coachReply } from "@/lib/agent/chat";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  section: z.object({
    title: z.string(),
    optimized: z.string(),
    text: z.string(),
    keyPoints: z.array(z.string()),
  }),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1)
    .max(20),
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
  const reply = await coachReply(parsed.data.section, parsed.data.messages);
  return NextResponse.json({ reply });
}
