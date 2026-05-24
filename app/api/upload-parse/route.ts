import { NextRequest, NextResponse } from "next/server";
import { parseFile, sourceTypeFor } from "@/lib/parse";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });
  const buf = await file.arrayBuffer();
  const rawText = await parseFile(file.name, buf);
  return NextResponse.json({ rawText, title: file.name, sourceType: sourceTypeFor(file.name) });
}
