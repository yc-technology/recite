import type { Section, StudyPlan } from "@/lib/agent/schema";

// Pure insert: clamp position into [0, length], splice the section in, return a
// new plan (input is not mutated). Single source of truth for insert semantics.
export function insertSectionIntoPlan(
  plan: StudyPlan,
  position: number,
  section: Section,
): StudyPlan {
  const n = plan.sections.length;
  const pos = Math.max(0, Math.min(Math.trunc(position), n));
  const sections = [...plan.sections.slice(0, pos), section, ...plan.sections.slice(pos)];
  return { sections };
}
