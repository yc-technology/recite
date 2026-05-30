import { Agent, run } from "@openai/agents";
import {
  EnrichmentsSchema,
  type Normalized,
  type NormalizedSection,
  type Section,
  type OptimizeStyle,
} from "./schema";
import { normalizePresentation } from "./normalize";
import { analyzeSections } from "./analyze";

// Force normalize's (possibly multi-section) output into ONE section:
// keep the first non-empty title, join all non-empty texts with a blank line.
export function collapseToOneSection(normalized: Normalized): NormalizedSection {
  const sections = normalized.sections ?? [];
  const title = sections.map((s) => s.title.trim()).find((t) => t.length > 0) ?? "Untitled";
  const text = sections
    .map((s) => s.text.trim())
    .filter((t) => t.length > 0)
    .join("\n\n");
  return { title, text };
}
