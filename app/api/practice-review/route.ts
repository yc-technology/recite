import { NextRequest, NextResponse } from "next/server";
import { review, Grade } from "@/lib/srs/sm2";
import { memoryStore } from "@/lib/store/memory";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { id, segmentIndex, grade } = await req.json();
  const rec = await memoryStore.get(id, "local");
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });
  const now = new Date();
  const practice = rec.practice.map((p) =>
    p.segmentIndex === segmentIndex
      ? { ...review(p, grade as Grade, now), segmentIndex }
      : p
  );
  await memoryStore.updatePractice(id, "local", practice);
  return NextResponse.json({ ok: true });
}
