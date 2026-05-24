import { describe, it, expect } from "vitest";
import { review, initialCard, Grade } from "@/lib/srs/sm2";

describe("sm2", () => {
  const now = new Date("2026-05-24T00:00:00Z");
  it("initial card is due now with ease 2.5", () => {
    const c = initialCard(now);
    expect(c.repetitions).toBe(0);
    expect(c.intervalDays).toBe(0);
    expect(c.ease).toBeCloseTo(2.5);
    expect(c.dueAt.getTime()).toBe(now.getTime());
  });
  it("Again resets reps and schedules same day", () => {
    const c = review(initialCard(now), Grade.Again, now);
    expect(c.repetitions).toBe(0);
    expect(c.intervalDays).toBe(0);
    expect(c.ease).toBeCloseTo(2.3); // 2.5 - 0.2 floor 1.3
  });
  it("Good progression: 1 day, then 6 days, then ease*interval", () => {
    let c = review(initialCard(now), Grade.Good, now);
    expect(c.intervalDays).toBe(1);
    c = review(c, Grade.Good, now);
    expect(c.intervalDays).toBe(6);
    const prevEase = c.ease;
    c = review(c, Grade.Good, now);
    expect(c.intervalDays).toBe(Math.round(6 * prevEase));
  });
  it("ease never drops below 1.3", () => {
    let c = initialCard(now);
    for (let i = 0; i < 20; i++) c = review(c, Grade.Again, now);
    expect(c.ease).toBeGreaterThanOrEqual(1.3);
  });
});
