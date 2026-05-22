import { PDFParse } from "pdf-parse";

export async function extractText(buffer: Buffer, fileName: string, mimeType: string) {
  const lowerName = fileName.toLowerCase();

  if (mimeType.includes("pdf") || lowerName.endsWith(".pdf")) {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    return result.text;
  }

  return buffer.toString("utf8");
}

export function chunkText(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const chunks: string[] = [];
  const size = 900;
  const overlap = 120;

  for (let start = 0; start < cleaned.length; start += size - overlap) {
    chunks.push(cleaned.slice(start, start + size));
  }

  return chunks;
}
