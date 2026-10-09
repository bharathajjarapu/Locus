import { extract, render, type Page } from "@/lib/pdf";
import { ocr } from "@/lib/vision";

// Plain-text files are read as they are
const plain = /\.(txt|md|markdown|json|csv|tsv|js|jsx|ts|tsx|py|rs|go|java|c|cpp|h|sh|yaml|yml|toml|html|css|xml|log)$/i;
// Most scanned pages or embedded images read per file, so a big scan cannot run for minutes
const most = 15;
// Embedded pictures smaller than this are icons and logos, not content
const small = 20_000;
type Office = { text: string; pictures: { data: Uint8Array; mediaType: string }[] } | { pdf: Uint8Array };

// Converts an Office file in a disposable worker so large files cannot block chat.
function office(bytes: Uint8Array): Promise<Office> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./docs.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }: MessageEvent<Office | { error: string }>) => {
      worker.terminate();
      if ("error" in data) reject(new Error(data.error)); else resolve(data);
    };
    worker.onerror = (event) => { worker.terminate(); reject(new Error(event.message || "Could not read this document")); };
    worker.postMessage({ bytes, most, small }, [bytes.buffer]);
  });
}

// Joins page texts under page headings
const pages = (items: Page[]) => items.map((page) => `## Page ${page.number}\n\n${page.text}`).join("\n\n");

// Keeps PDF page positions, using OCR only for pages without a text layer.
async function pdf(bytes: Uint8Array) {
  const items = await extract(bytes);
  const scanned = items.filter((page) => page.scanned).slice(0, most);
  if (scanned.length) {
    const texts = await ocr(await render(bytes, scanned.map((page) => page.number)));
    scanned.forEach((page, index) => { page.text = texts[index]; });
  }
  if (!items.some((page) => page.text.trim())) throw new Error("No readable text");
  return { text: pages(items), pages: items };
}

// Extracts office text with AnyDoc and PDF page text with pdf.js or OCR.
export async function read(file: File): Promise<{ text: string; pages?: Page[] }> {
  if (file.type.startsWith("image/")) return { text: (await ocr([file]))[0] };
  if (file.type.startsWith("text/") || plain.test(file.name)) return { text: await file.text() };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return pdf(bytes);
  const content = await office(bytes);
  if ("pdf" in content) return pdf(content.pdf);
  const { text, pictures } = content;
  if (!pictures.length) return { text };
  const texts = await ocr(pictures.map((asset) => new Blob([asset.data as Uint8Array<ArrayBuffer>], { type: asset.mediaType })));
  return { text: `${text}\n\n${texts.map((value, index) => `## Picture ${index + 1}\n\n${value}`).join("\n\n")}` };
}
