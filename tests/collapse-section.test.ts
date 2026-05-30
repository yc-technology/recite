import { describe, it, expect } from "vitest";
import { collapseToOneSection } from "@/lib/agent/addSection";

describe("collapseToOneSection", () => {
  it("joins multiple sections' text with a blank line and keeps the first title", () => {
    const one = collapseToOneSection({
      sections: [
        { title: "Intro", text: "Hello there." },
        { title: "Body", text: "More content." },
      ],
    });
    expect(one.title).toBe("Intro");
    expect(one.text).toBe("Hello there.\n\nMore content.");
  });

  it("passes a single section through unchanged", () => {
    const one = collapseToOneSection({ sections: [{ title: "Solo", text: "Just one." }] });
    expect(one).toEqual({ title: "Solo", text: "Just one." });
  });

  it("falls back to 'Untitled' and empty text when there are no sections", () => {
    const one = collapseToOneSection({ sections: [] });
    expect(one).toEqual({ title: "Untitled", text: "" });
  });

  it("trims surrounding whitespace and skips empty fragments", () => {
    const one = collapseToOneSection({
      sections: [
        { title: "  Title  ", text: "  first  " },
        { title: "B", text: "   " },
        { title: "C", text: "second" },
      ],
    });
    expect(one.title).toBe("Title");
    expect(one.text).toBe("first\n\nsecond");
  });
});
