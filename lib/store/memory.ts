import type { Store, PresentationRecord, PracticeState } from "./types";

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
  async rename(id, userId, title) {
    const r = db.get(id);
    if (r && r.userId === userId) r.title = title;
  },
  async remove(id, userId) {
    const r = db.get(id);
    if (r && r.userId === userId) db.delete(id);
  },
};
