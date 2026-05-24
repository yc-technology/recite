import type { StudyPlan, Segment } from "@/lib/agent/schema";
import type { SrsCard } from "@/lib/srs/types";

export interface PracticeState extends SrsCard { segmentIndex: number; }

export interface PresentationRecord {
  id: string;
  userId: string;
  title: string;
  rawText: string;
  sourceType: string;
  plan: StudyPlan;
  practice: PracticeState[]; // one per segment
}

export interface Store {
  create(input: Omit<PresentationRecord, "id">): Promise<PresentationRecord>;
  get(id: string, userId: string): Promise<PresentationRecord | null>;
  listByUser(userId: string): Promise<PresentationRecord[]>;
  updatePractice(id: string, userId: string, practice: PracticeState[]): Promise<void>;
}

export type { StudyPlan, Segment };
