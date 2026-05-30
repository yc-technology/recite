import { describe, it, expect } from "vitest";
import { insertSectionIntoPlan } from "@/lib/sections";
import type { Section, StudyPlan } from "@/lib/agent/schema";

const mk = (t: string): Section => ({
  title: t, text: t, optimized: t, summary: "", keyPoints: [], difficulty: "medium",
});
const plan = (): StudyPlan => ({ sections: [mk("A"), mk("B"), mk("C")] });

describe("insertSectionIntoPlan", () => {
  it("inserts in the middle", () => {
    const out = insertSectionIntoPlan(plan(), 1, mk("NEW"));
    expect(out.sections.map((s) => s.title)).toEqual(["A", "NEW", "B", "C"]);
  });

  it("inserts at the start", () => {
    const out = insertSectionIntoPlan(plan(), 0, mk("NEW"));
    expect(out.sections.map((s) => s.title)).toEqual(["NEW", "A", "B", "C"]);
  });

  it("appends at the end when position == length", () => {
    const out = insertSectionIntoPlan(plan(), 3, mk("NEW"));
    expect(out.sections.map((s) => s.title)).toEqual(["A", "B", "C", "NEW"]);
  });

  it("clamps an out-of-range position to the end", () => {
    const out = insertSectionIntoPlan(plan(), 99, mk("NEW"));
    expect(out.sections.map((s) => s.title)).toEqual(["A", "B", "C", "NEW"]);
  });

  it("clamps a negative position to the start and does not mutate the input", () => {
    const original = plan();
    const out = insertSectionIntoPlan(original, -5, mk("NEW"));
    expect(out.sections.map((s) => s.title)).toEqual(["NEW", "A", "B", "C"]);
    expect(original.sections).toHaveLength(3); // input untouched
  });
});
