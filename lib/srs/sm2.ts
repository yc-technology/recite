import type { SrsCard } from "./types";
export type { SrsCard } from "./types";

export enum Grade { Again = 0, Hard = 1, Good = 2, Easy = 3 }

const MIN_EASE = 1.3;
const addDays = (d: Date, n: number) =>
  new Date(d.getTime() + n * 86_400_000);

export function initialCard(now: Date): SrsCard {
  return { ease: 2.5, intervalDays: 0, repetitions: 0, dueAt: new Date(now), lastReviewedAt: null };
}

const easeDelta: Record<Grade, number> = {
  [Grade.Again]: -0.2, [Grade.Hard]: -0.15, [Grade.Good]: 0, [Grade.Easy]: 0.15,
};

export function review(card: SrsCard, grade: Grade, now: Date): SrsCard {
  const ease = Math.max(MIN_EASE, card.ease + easeDelta[grade]);
  if (grade === Grade.Again) {
    return { ease, intervalDays: 0, repetitions: 0, dueAt: new Date(now), lastReviewedAt: new Date(now) };
  }
  const repetitions = card.repetitions + 1;
  let intervalDays: number;
  if (repetitions === 1) intervalDays = grade === Grade.Easy ? 3 : 1;
  else if (repetitions === 2) intervalDays = 6;
  else intervalDays = Math.round(card.intervalDays * ease);
  return { ease, intervalDays, repetitions, dueAt: addDays(now, intervalDays), lastReviewedAt: new Date(now) };
}
