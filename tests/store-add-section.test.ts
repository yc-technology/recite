import { describe, it, expect } from "vitest";
import { memoryStore } from "@/lib/store/memory";
import type { PresentationRecord } from "@/lib/store/types";
import { initialCard } from "@/lib/srs/sm2";

const mkSection = (t: string) => ({
  title: t, text: t, optimized: t, summary: "", keyPoints: [], difficulty: "medium" as const,
});

function seed(): Omit<PresentationRecord, "id"> {
  const now = new Date();
  return {
    userId: "u1",
    title: "Talk",
    rawText: "a\n\nb",
    sourceType: "text",
    plan: { sections: [mkSection("A"), mkSection("B")] },
    practice: [
      { ...initialCard(now), segmentIndex: 0, masteryLevel: 3 },
      { ...initialCard(now), segmentIndex: 1, masteryLevel: 2 },
    ],
  };
}

describe("addSection", () => {
  it("inserts a section in the middle and reindexes trailing sections + practice", async () => {
    const rec = await memoryStore.create(seed());
    await memoryStore.addSection(rec.id, "u1", 1, mkSection("NEW"));
    const got = await memoryStore.get(rec.id, "u1");

    expect(got?.plan.sections.map((s) => s.title)).toEqual(["A", "NEW", "B"]);
    expect(got?.practice.map((p) => p.segmentIndex).sort((x, y) => x - y)).toEqual([0, 1, 2]);
    const shifted = got?.practice.find((p) => p.segmentIndex === 2);
    expect(shifted?.masteryLevel).toBe(2);
    const fresh = got?.practice.find((p) => p.segmentIndex === 1);
    expect(fresh?.masteryLevel).toBe(1);
    expect(fresh?.repetitions).toBe(0);
  });

  it("appends at the end when position == length", async () => {
    const rec = await memoryStore.create(seed());
    await memoryStore.addSection(rec.id, "u1", 2, mkSection("NEW"));
    const got = await memoryStore.get(rec.id, "u1");
    expect(got?.plan.sections.map((s) => s.title)).toEqual(["A", "B", "NEW"]);
    expect(got?.practice.find((p) => p.segmentIndex === 2)?.masteryLevel).toBe(1);
  });

  it("is a no-op for a non-owner", async () => {
    const rec = await memoryStore.create(seed());
    await memoryStore.addSection(rec.id, "intruder", 0, mkSection("HACK"));
    const got = await memoryStore.get(rec.id, "u1");
    expect(got?.plan.sections).toHaveLength(2);
  });
});
