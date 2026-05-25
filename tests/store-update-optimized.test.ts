import { describe, it, expect } from "vitest";
import { memoryStore } from "@/lib/store/memory";
import type { PresentationRecord } from "@/lib/store/types";

function seed(): Omit<PresentationRecord, "id"> {
  return {
    userId: "u1",
    title: "Talk",
    rawText: "a\n\nb",
    sourceType: "text",
    plan: {
      sections: [
        { title: "A", text: "a", optimized: "old A", summary: "", keyPoints: [], difficulty: "medium" },
        { title: "B", text: "b", optimized: "old B", summary: "", keyPoints: [], difficulty: "medium" },
      ],
    },
    practice: [],
  };
}

describe("updateOptimized", () => {
  it("replaces one section's optimized text and leaves others untouched", async () => {
    const rec = await memoryStore.create(seed());
    await memoryStore.updateOptimized(rec.id, "u1", 1, "new B");
    const got = await memoryStore.get(rec.id, "u1");
    expect(got?.plan.sections[1].optimized).toBe("new B");
    expect(got?.plan.sections[0].optimized).toBe("old A");
  });

  it("is a no-op for a non-owner", async () => {
    const rec = await memoryStore.create(seed());
    await memoryStore.updateOptimized(rec.id, "intruder", 0, "hacked");
    const got = await memoryStore.get(rec.id, "u1");
    expect(got?.plan.sections[0].optimized).toBe("old A");
  });
});
