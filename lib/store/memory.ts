import type { Store, PresentationRecord, PracticeState } from "./types";
import { insertSectionIntoPlan } from "@/lib/sections";
import { initialCard } from "@/lib/srs/sm2";
import type { Section } from "@/lib/agent/schema";

const db = new Map<string, PresentationRecord>();

export const memoryStore: Store = {
  async create(input) {
    const id = crypto.randomUUID();
    const rec = { ...input, id };
    db.set(id, rec);
    return rec;
  },
  async get(id, userId) {
    const r = db.get(id);
    return r && r.userId === userId ? r : null;
  },
  async listByUser(userId) {
    return [...db.values()].filter((r) => r.userId === userId);
  },
  async updatePractice(id, userId, practice: PracticeState[]) {
    const r = db.get(id);
    if (r && r.userId === userId) r.practice = practice;
  },
  async updateOptimized(id, userId, sectionIndex, optimized) {
    const r = db.get(id);
    if (r && r.userId === userId && r.plan.sections[sectionIndex]) {
      r.plan.sections[sectionIndex].optimized = optimized;
    }
  },
  async addSection(id, userId, position, section: Section) {
    const r = db.get(id);
    if (!r || r.userId !== userId) return;
    const n = r.plan.sections.length;
    const pos = Math.max(0, Math.min(Math.trunc(position), n));
    r.plan = insertSectionIntoPlan(r.plan, pos, section);
    // shift trailing practice cards, then add a fresh card at `pos`
    for (const p of r.practice) if (p.segmentIndex >= pos) p.segmentIndex += 1;
    r.practice.push({ ...initialCard(new Date()), segmentIndex: pos, masteryLevel: 1 });
  },
  async rename(id, userId, title) {
    const r = db.get(id);
    if (r && r.userId === userId) r.title = title;
  },
  async remove(id, userId) {
    const r = db.get(id);
    if (r && r.userId === userId) db.delete(id);
  },
};
