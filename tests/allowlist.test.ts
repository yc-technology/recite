import { describe, it, expect, afterEach } from "vitest";
import { isLlmAllowed } from "@/lib/allowlist";

const orig = process.env.LLM_ALLOWED_EMAILS;
afterEach(() => {
  if (orig === undefined) delete process.env.LLM_ALLOWED_EMAILS;
  else process.env.LLM_ALLOWED_EMAILS = orig;
});

describe("isLlmAllowed", () => {
  it("allows everyone when the env is unset", () => {
    delete process.env.LLM_ALLOWED_EMAILS;
    expect(isLlmAllowed("anyone@x.com")).toBe(true);
    expect(isLlmAllowed(null)).toBe(true);
  });
  it("permits only listed emails (case-insensitive) when set", () => {
    process.env.LLM_ALLOWED_EMAILS = "me@x.com, you@y.com";
    expect(isLlmAllowed("ME@x.com")).toBe(true);
    expect(isLlmAllowed("you@y.com")).toBe(true);
    expect(isLlmAllowed("stranger@z.com")).toBe(false);
    expect(isLlmAllowed(null)).toBe(false);
  });
});
