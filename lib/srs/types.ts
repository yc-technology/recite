export interface SrsCard {
  ease: number;          // >= 1.3
  intervalDays: number;  // 0 = same day
  repetitions: number;   // consecutive non-Again
  dueAt: Date;
  lastReviewedAt: Date | null;
}
