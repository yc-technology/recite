import { parseText } from "./text";
import { parsePdf } from "./pdf";
import { parsePptx } from "./pptx";

export type SourceType = "pdf" | "pptx" | "text";

export function sourceTypeFor(filename: string): SourceType {
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") return "pdf";
  if (ext === "pptx") return "pptx";
  return "text"; // md, txt, etc.
}

export async function parseFile(filename: string, buf: ArrayBuffer): Promise<string> {
  switch (sourceTypeFor(filename)) {
    case "pdf": return parsePdf(buf);
    case "pptx": return parsePptx(buf);
    default: return parseText(buf);
  }
}
