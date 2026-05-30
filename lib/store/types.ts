import type { StudyPlan, Section } from "@/lib/agent/schema";
import type { SrsCard } from "@/lib/srs/types";

export interface PracticeState extends SrsCard {
  segmentIndex: number; // index into plan.sections
  masteryLevel: number; // 1..3 scaffold level (1 = most hints shown)
}

export interface PresentationRecord {
  id: string;
  userId: string;
  title: string;
  rawText: string;
  sourceType: string;
  plan: StudyPlan;
  practice: PracticeState[]; // one per section
}

export interface Store {
  create(input: Omit<PresentationRecord, "id">): Promise<PresentationRecord>;
  get(id: string, userId: string): Promise<PresentationRecord | null>;
  listByUser(userId: string): Promise<PresentationRecord[]>;
  updatePractice(id: string, userId: string, practice: PracticeState[]): Promise<void>;
  updateOptimized(id: string, userId: string, sectionIndex: number, optimized: string): Promise<void>;
  addSection(id: string, userId: string, position: number, section: Section): Promise<void>;
  rename(id: string, userId: string, title: string): Promise<void>;
  remove(id: string, userId: string): Promise<void>;
}

export type { StudyPlan, Section };
