import { describe, it, expect } from "vitest";
import { StudyPlanSchema } from "@/lib/agent/schema";

describe("StudyPlanSchema", () => {
  it("accepts a well-formed plan", () => {
    const ok = StudyPlanSchema.safeParse({
      segments: [{ title: "Intro", content: "Hi.", difficulty: "easy", hints: ["greeting"] }],
      dailySchedule: [{ dayIndex: 0, segmentIndexes: [0], taskType: "learn" }],
    });
    expect(ok.success).toBe(true);
  });
  it("rejects bad difficulty", () => {
    const bad = StudyPlanSchema.safeParse({
      segments: [{ title: "x", content: "y", difficulty: "huge", hints: [] }],
      dailySchedule: [],
    });
    expect(bad.success).toBe(false);
  });
});
