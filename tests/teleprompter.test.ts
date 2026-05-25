import { describe, it, expect } from "vitest";
import { toParagraphs } from "@/lib/teleprompter";

describe("toParagraphs", () => {
  it("splits blank-line separated paragraphs", () => {
    expect(toParagraphs("First para.\n\nSecond para.")).toEqual([
      "First para.",
      "Second para.",
    ]);
  });

  it("treats each bullet line as its own unit", () => {
    expect(toParagraphs("Intro line.\n- one\n- two")).toEqual([
      "Intro line.",
      "- one",
      "- two",
    ]);
  });

  it("trims whitespace and drops empty lines", () => {
    expect(toParagraphs("\n\n  hello  \n\n")).toEqual(["hello"]);
  });

  it("returns [] for empty or whitespace-only input", () => {
    expect(toParagraphs("   \n  ")).toEqual([]);
  });
});
