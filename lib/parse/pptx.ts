import JSZip from "jszip";

export async function parsePptx(buf: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const parts: string[] = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async("string");
    const matches = xml.match(/<a:t>([\s\S]*?)<\/a:t>/g) ?? [];
    for (const m of matches) parts.push(m.replace(/<\/?a:t>/g, ""));
  }
  return parts.join(" ").replace(/\s+/g, " ").trim();
}
