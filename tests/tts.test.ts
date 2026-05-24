import { describe, it, expect } from "vitest";
import { stripMarkdown, splitSentences } from "@/lib/tts";

describe("stripMarkdown", () => {
  it("removes markdown markers and bullet prefixes", () => {
    expect(stripMarkdown("**Bold** and `code`")).toBe("Bold and code");
    expect(stripMarkdown("- one\n- two")).toBe("one two");
  });
});

describe("splitSentences", () => {
  it("splits clean text into sentences", () => {
    expect(splitSentences("Hello world. I am here!")).toEqual([
      "Hello world.",
      "I am here!",
    ]);
  });
  it("strips markdown before splitting", () => {
    const r = splitSentences("**Hi.** Use it.");
    expect(r).toEqual(["Hi.", "Use it."]);
  });
  it("returns [] for empty input", () => {
    expect(splitSentences("   ")).toEqual([]);
  });
});
