import { describe, it, expect } from "vitest";
import { mergeEnrichments } from "@/lib/agent/analyze";
import type { Enrichment } from "@/lib/agent/schema";

const sections = [
  { title: "Intro", text: "Hello there." },
  { title: "Body", text: "The main point." },
];

describe("mergeEnrichments", () => {
  it("keeps title/text exact and attaches enrichment by index", () => {
    const enrichments: Enrichment[] = [
      { summary: "greeting", keyPoints: ["hi"], difficulty: "easy", optimized: "Hi!" },
      { summary: "point", keyPoints: ["main"], difficulty: "medium", optimized: "The point." },
    ];
    const plan = mergeEnrichments(sections, enrichments);
    expect(plan.sections[0].title).toBe("Intro");
    expect(plan.sections[0].text).toBe("Hello there."); // never altered by model
    expect(plan.sections[0].optimized).toBe("Hi!");
    expect(plan.sections[1].summary).toBe("point");
  });

  it("falls back gracefully when the model returns fewer enrichments", () => {
    const enrichments: Enrichment[] = [
      { summary: "greeting", keyPoints: ["hi"], difficulty: "easy", optimized: "Hi!" },
    ];
    const plan = mergeEnrichments(sections, enrichments);
    expect(plan.sections).toHaveLength(2);
    // second section gets safe defaults + optimized falls back to original text
    expect(plan.sections[1].difficulty).toBe("medium");
    expect(plan.sections[1].keyPoints).toEqual([]);
    expect(plan.sections[1].optimized).toBe("The main point.");
  });

  it("falls back optimized to original when the model returns an empty string", () => {
    const enrichments: Enrichment[] = [
      { summary: "s", keyPoints: [], difficulty: "hard", optimized: "" },
      { summary: "s", keyPoints: [], difficulty: "hard", optimized: "" },
    ];
    const plan = mergeEnrichments(sections, enrichments);
    expect(plan.sections[0].optimized).toBe("Hello there.");
  });
});
