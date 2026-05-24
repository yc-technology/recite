import { extractText, getDocumentProxy } from "unpdf";

export async function parsePdf(buf: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}
