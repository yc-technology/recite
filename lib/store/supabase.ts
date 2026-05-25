import type { Store, PresentationRecord, PracticeState } from "./types";
import { createClient } from "@/lib/supabase/server";

export const supabaseStore: Store = {
  async create(input) {
    const supabase = await createClient();

    const { data: pres, error: presErr } = await supabase
      .from("presentations")
      .insert({
        user_id: input.userId,
        title: input.title,
        raw_text: input.rawText,
        source_type: input.sourceType,
      })
      .select("id")
      .single();
    if (presErr || !pres) throw presErr ?? new Error("insert presentation failed");
    const presentationId = pres.id as string;

    const segRows = input.plan.sections.map((s, i) => ({
      presentation_id: presentationId,
      order_index: i,
      title: s.title,
      content: s.text, // cleaned original (原版)
      optimized: s.optimized, // polished rewrite (优化版)
      summary: s.summary,
      key_points: s.keyPoints,
      difficulty: s.difficulty,
    }));
    if (segRows.length) {
      const { error } = await supabase.from("segments").insert(segRows);
      if (error) throw error;
    }

    const practiceRows = input.practice.map((p) => ({
      presentation_id: presentationId,
      user_id: input.userId,
      segment_index: p.segmentIndex,
      mastery_level: p.masteryLevel,
      ease: p.ease,
      interval_days: p.intervalDays,
      repetitions: p.repetitions,
      due_at: p.dueAt.toISOString(),
      last_reviewed_at: p.lastReviewedAt ? p.lastReviewedAt.toISOString() : null,
    }));
    if (practiceRows.length) {
      const { error } = await supabase.from("practice_records").insert(practiceRows);
      if (error) throw error;
    }

    return { ...input, id: presentationId };
  },

  async get(id, userId) {
    const supabase = await createClient();

    const { data: pres } = await supabase
      .from("presentations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!pres || pres.user_id !== userId) return null;

    const { data: segs } = await supabase
      .from("segments")
      .select("*")
      .eq("presentation_id", id)
      .order("order_index", { ascending: true });

    const { data: practice } = await supabase
      .from("practice_records")
      .select("*")
      .eq("presentation_id", id)
      .order("segment_index", { ascending: true });

    const record: PresentationRecord = {
      id: pres.id,
      userId: pres.user_id,
      title: pres.title,
      rawText: pres.raw_text,
      sourceType: pres.source_type,
      plan: {
        sections: (segs ?? []).map((s) => ({
          title: s.title,
          text: s.content,
          optimized: s.optimized || s.content,
          summary: s.summary ?? "",
          keyPoints: s.key_points ?? [],
          difficulty: s.difficulty,
        })),
      },
      practice: (practice ?? []).map((p) => ({
        segmentIndex: p.segment_index,
        masteryLevel: p.mastery_level ?? 1,
        ease: p.ease,
        intervalDays: p.interval_days,
        repetitions: p.repetitions,
        dueAt: new Date(p.due_at),
        lastReviewedAt: p.last_reviewed_at ? new Date(p.last_reviewed_at) : null,
      })),
    };
    return record;
  },

  async listByUser(userId) {
    const supabase = await createClient();
    const { data: rows } = await supabase
      .from("presentations")
      .select("id")
      .order("created_at", { ascending: false });
    const ids = (rows ?? []).map((r) => r.id as string);
    const records = await Promise.all(ids.map((id) => this.get(id, userId)));
    return records.filter((r): r is PresentationRecord => r !== null);
  },

  async updatePractice(id, userId, practice: PracticeState[]) {
    const supabase = await createClient();
    // Ownership is enforced by RLS; userId is used by callers for the get() guard.
    void userId;
    for (const p of practice) {
      const { error } = await supabase
        .from("practice_records")
        .update({
          mastery_level: p.masteryLevel,
          ease: p.ease,
          interval_days: p.intervalDays,
          repetitions: p.repetitions,
          due_at: p.dueAt.toISOString(),
          last_reviewed_at: p.lastReviewedAt ? p.lastReviewedAt.toISOString() : null,
        })
        .eq("presentation_id", id)
        .eq("segment_index", p.segmentIndex);
      if (error) throw error;
    }
  },

  async updateOptimized(id, userId, sectionIndex, optimized) {
    const supabase = await createClient();
    void userId; // RLS scopes the update to the owner
    const { error, count } = await supabase
      .from("segments")
      .update({ optimized }, { count: "exact" })
      .eq("presentation_id", id)
      .eq("order_index", sectionIndex);
    if (error) throw error;
    if (count === 0) throw new Error(`segment ${sectionIndex} not found`);
  },

  async rename(id, userId, title) {
    const supabase = await createClient();
    void userId; // RLS scopes the update to the owner
    const { error } = await supabase
      .from("presentations")
      .update({ title })
      .eq("id", id);
    if (error) throw error;
  },

  async remove(id, userId) {
    const supabase = await createClient();
    void userId; // RLS scopes the delete; FK cascade removes segments/practice
    const { error } = await supabase.from("presentations").delete().eq("id", id);
    if (error) throw error;
  },
};
