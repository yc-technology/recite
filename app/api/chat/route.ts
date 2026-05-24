import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { coachReply } from "@/lib/agent/chat";
import { listChat, appendChat } from "@/lib/store/chat";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/ratelimit";
import { isLlmAllowed } from "@/lib/allowlist";
export const runtime = "nodejs";
export const maxDuration = 60;

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Load the saved conversation for a section.
export async function GET(req: NextRequest) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const presentationId = searchParams.get("presentationId");
  const sectionIndex = Number(searchParams.get("sectionIndex"));
  if (!presentationId || !Number.isInteger(sectionIndex)) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const messages = await listChat(presentationId, sectionIndex);
  return NextResponse.json({ messages });
}

const Body = z.object({
  presentationId: z.string().min(1),
  sectionIndex: z.number().int().nonnegative(),
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
    .max(40),
});

export async function POST(req: NextRequest) {
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isLlmAllowed(user.email)) {
    return NextResponse.json({ error: "not allowed" }, { status: 403 });
  }
  if (!(await rateLimit(user.id, "chat", 60, 600))) {
    return NextResponse.json({ error: "rate limited — try again later" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const { presentationId, sectionIndex, section, messages } = parsed.data;

  try {
    const reply = await coachReply(section, messages);

    // Persist only the new turn (the last user message + this reply).
    const lastUser = messages[messages.length - 1];
    await appendChat(presentationId, user.id, sectionIndex, [
      lastUser,
      { role: "assistant", content: reply },
    ]);

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("chat failed:", e);
    return NextResponse.json({ error: "chat failed" }, { status: 502 });
  }
}
