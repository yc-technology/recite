import { describe, it, expect } from "vitest";
import { buildRefinePrompt } from "@/lib/agent/refine";

describe("buildRefinePrompt", () => {
  it("includes the title, current text, the instruction, and the no-headings rule", () => {
    const p = buildRefinePrompt("Market", "Our market is huge.", "make it more conversational");
    expect(p).toContain("Market");
    expect(p).toContain("Our market is huge.");
    expect(p).toContain("make it more conversational");
    expect(p).toMatch(/do not use headings/i);
    expect(p).toMatch(/do not add new facts/i);
  });

  it("uses image-reference wording when instruction is empty and an image is attached", () => {
    const p = buildRefinePrompt("Market", "Our market is huge.", "", true);
    expect(p).toMatch(/using the attached image as reference/i);
    expect(p).toMatch(/image is attached as visual reference/i);
    expect(p).toMatch(/do not add new facts/i);
    expect(p).not.toContain("Apply this instruction");
  });

  it("keeps the instruction line and adds the image rule when both are present", () => {
    const p = buildRefinePrompt("Market", "Our market is huge.", "shorten it", true);
    expect(p).toContain("shorten it");
    expect(p).toMatch(/image is attached as visual reference/i);
  });
});
