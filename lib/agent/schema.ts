import { z } from "zod";

// ── Stage 1: normalize ────────────────────────────────────────────────
// Raw, messy upload text → clean, sectioned data. Structured output (not
// markdown) so section boundaries are reliable regardless of input style.
export const NormalizedSectionSchema = z.object({
  title: z.string(),
  text: z.string(), // cleaned prose for this section — faithful, no added meaning
});
export const NormalizedSchema = z.object({
  sections: z.array(NormalizedSectionSchema),
});

// ── Stage 2: analyze ──────────────────────────────────────────────────
// The agent returns ONLY the added fields, aligned by index, so it can never
// alter the (already-clean) original text. We merge in code.
export const EnrichmentSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  difficulty: z.enum(["easy", "medium", "hard"]),
  optimized: z.string(), // polished, presentation-ready rewrite of this section
});
export const EnrichmentsSchema = z.object({
  enrichments: z.array(EnrichmentSchema),
});

// ── Merged section (what the app stores and renders) ──────────────────
export const SectionSchema = z.object({
  title: z.string(),
  text: z.string(), // cleaned original (原版) — shown for comparison
  optimized: z.string(), // polished presentation-ready rewrite (优化版)
  summary: z.string(),
  keyPoints: z.array(z.string()),
  difficulty: z.enum(["easy", "medium", "hard"]),
});
export const StudyPlanSchema = z.object({
  sections: z.array(SectionSchema),
});

// Preferred style for the "optimized" rewrite, chosen at analysis time.
export const OptimizeStyleSchema = z.enum([
  "simple",
  "native",
  "formal",
  "concise",
]);
export type OptimizeStyle = z.infer<typeof OptimizeStyleSchema>;

export type Normalized = z.infer<typeof NormalizedSchema>;
export type NormalizedSection = z.infer<typeof NormalizedSectionSchema>;
export type Enrichment = z.infer<typeof EnrichmentSchema>;
export type StudyPlan = z.infer<typeof StudyPlanSchema>;
export type Section = z.infer<typeof SectionSchema>;
