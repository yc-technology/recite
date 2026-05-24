import { NextRequest, NextResponse } from "next/server";
import { analyzePresentation } from "@/lib/agent/analyze";
import { initialCard } from "@/lib/srs/sm2";
import { memoryStore } from "@/lib/store/memory";
import type { PracticeState } from "@/lib/store/types";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { rawText, title, sourceType } = await req.json();
  if (!rawText) return NextResponse.json({ error: "no text" }, { status: 400 });
  const plan = await analyzePresentation(rawText);
  const now = new Date();
  const practice: PracticeState[] = plan.segments.map((_, i) => ({
    ...initialCard(now), segmentIndex: i,
  }));
  const rec = await memoryStore.create({
    userId: "local", title, rawText, sourceType, plan, practice,
  });
  return NextResponse.json({ id: rec.id });
}
