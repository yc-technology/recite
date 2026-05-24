import { describe, it, expect } from "vitest";
import {
  StudyPlanSchema,
  NormalizedSchema,
  EnrichmentsSchema,
  WriteReviewSchema,
} from "@/lib/agent/schema";

describe("WriteReviewSchema", () => {
  it("accepts a well-formed review", () => {
    const ok = WriteReviewSchema.safeParse({
      corrected: "I went to the store.",
      issues: [
        { excerpt: "I go to store", type: "grammar", explanation: "tense + article", fix: "I went to the store" },
      ],
      comment: "Clear, just watch tense.",
    });
    expect(ok.success).toBe(true);
  });
  it("accepts an empty issues list", () => {
    const ok = WriteReviewSchema.safeParse({
      corrected: "Looks good.",
      issues: [],
      comment: "Already clean.",
    });
    expect(ok.success).toBe(true);
  });
});

describe("NormalizedSchema", () => {
  it("accepts sectioned clean text", () => {
    const ok = NormalizedSchema.safeParse({
      sections: [{ title: "Intro", text: "Good morning everyone." }],
    });
    expect(ok.success).toBe(true);
  });
});

describe("EnrichmentsSchema", () => {
  it("accepts per-section enrichments", () => {
    const ok = EnrichmentsSchema.safeParse({
      enrichments: [
        {
          summary: "Greeting and topic.",
          keyPoints: ["greet", "topic"],
          difficulty: "easy",
          optimized: "Good morning, everyone.",
        },
      ],
    });
    expect(ok.success).toBe(true);
  });
});

describe("StudyPlanSchema", () => {
  it("accepts a well-formed plan", () => {
    const ok = StudyPlanSchema.safeParse({
      sections: [
        {
          title: "Intro",
          text: "Hi everyone.",
          optimized: "Hello, everyone.",
          summary: "Opening greeting.",
          keyPoints: ["greeting"],
          difficulty: "easy",
        },
      ],
    });
    expect(ok.success).toBe(true);
  });
  it("rejects bad difficulty", () => {
    const bad = StudyPlanSchema.safeParse({
      sections: [
        { title: "x", text: "y", summary: "z", keyPoints: [], difficulty: "huge" },
      ],
    });
    expect(bad.success).toBe(false);
  });
});
