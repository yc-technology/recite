import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseStore } from "@/lib/store/supabase";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const PatchBody = z.object({ title: z.string().min(1).max(200) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = PatchBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const rec = await supabaseStore.get(id, user.id);
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });

  await supabaseStore.rename(id, user.id, parsed.data.title);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await authed();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rec = await supabaseStore.get(id, user.id);
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });

  await supabaseStore.remove(id, user.id);
  return NextResponse.json({ ok: true });
}
