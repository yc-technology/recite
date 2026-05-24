import { describe, it, expect } from "vitest";
import { parseText } from "@/lib/parse/text";
import { parsePptx } from "@/lib/parse/pptx";
import JSZip from "jszip";

describe("parseText", () => {
  it("returns decoded utf-8 text", async () => {
    const buf = new TextEncoder().encode("# Title\nbody");
    expect(await parseText(buf.buffer as ArrayBuffer)).toBe("# Title\nbody");
  });
});

describe("parsePptx", () => {
  it("extracts <a:t> text from slide xml", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml",
      `<p:sld><a:t>Hello</a:t><a:t>World</a:t></p:sld>`);
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    expect(await parsePptx(buf)).toBe("Hello World");
  });
});
