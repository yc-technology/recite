export async function parseText(buf: ArrayBuffer): Promise<string> {
  return new TextDecoder("utf-8").decode(buf).trim();
}
