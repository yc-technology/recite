import { z } from "zod";

export const SegmentSchema = z.object({
  title: z.string(),
  content: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  hints: z.array(z.string()),
});

export const DailyTaskSchema = z.object({
  dayIndex: z.number().int().nonnegative(),
  segmentIndexes: z.array(z.number().int().nonnegative()),
  taskType: z.enum(["learn", "review"]),
});

export const StudyPlanSchema = z.object({
  segments: z.array(SegmentSchema),
  dailySchedule: z.array(DailyTaskSchema),
});

export type StudyPlan = z.infer<typeof StudyPlanSchema>;
export type Segment = z.infer<typeof SegmentSchema>;
