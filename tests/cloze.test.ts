import { describe, it, expect } from "vitest";
import { maskSentences } from "@/lib/cloze";

describe("maskSentences", () => {
  it("splits into sentences and masks each with a blank", () => {
    const r = maskSentences("Hello world. I am here!");
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ answer: "Hello world.", masked: "____" });
    expect(r[1].answer).toBe("I am here!");
  });
  it("returns single item for blank-free input", () => {
    expect(maskSentences("")).toEqual([]);
  });
});
