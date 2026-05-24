import { describe, it, expect } from "vitest";
import { nextLevel } from "@/lib/srs/mastery";
import { Grade } from "@/lib/srs/sm2";

describe("nextLevel", () => {
  it("Good / Easy raise the level", () => {
    expect(nextLevel(1, Grade.Good)).toBe(2);
    expect(nextLevel(2, Grade.Easy)).toBe(3);
  });
  it("Again lowers the level", () => {
    expect(nextLevel(3, Grade.Again)).toBe(2);
    expect(nextLevel(2, Grade.Again)).toBe(1);
  });
  it("Hard holds the level", () => {
    expect(nextLevel(2, Grade.Hard)).toBe(2);
  });
  it("clamps to 1..3", () => {
    expect(nextLevel(3, Grade.Good)).toBe(3); // no overshoot
    expect(nextLevel(3, Grade.Easy)).toBe(3);
    expect(nextLevel(1, Grade.Again)).toBe(1); // no underflow
  });
});
