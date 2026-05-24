import { Grade } from "./sm2";

// Scaffold/mastery level (1..3) moves independently of the SM-2 interval:
// good recall removes hints, a lapse adds them back. Clamped to 1..3.
export function nextLevel(level: number, grade: Grade): number {
  if (grade === Grade.Again) return Math.max(1, level - 1);
  if (grade === Grade.Good || grade === Grade.Easy)
    return Math.min(3, level + 1);
  return level; // Hard: hold
}
