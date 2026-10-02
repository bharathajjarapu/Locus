import init, { formatFromBytes, toDocument, toMarkdownBytes } from "@firecrawl/anydoc-wasm";
import { render, text } from "@/lib/pdf";
import { ocr } from "@/lib/vision";

// Plain-text files are read as they are
const plain = /\.(txt|md|markdown|json|csv|tsv|js|jsx|ts|tsx|py|rs|go|java|c|cpp|h|sh|yaml|yml|toml|html|css|xml|log)$/i;
// Most scanned pages or embedded images read per file, so a big scan cannot run for minutes
const most = 15;
// Embedded pictures smaller than this are icons and logos, not content
const small = 20_000;

// Joins page texts under page headings
const pages = (numbers: number[], texts: string[]) => numbers.map((number, index) => `## Page ${number}\n\n${texts[index]}`).join("\n\n");

// Turns a file of any supported kind into text: office documents and PDFs through AnyDoc, pictures and scanned pages through the vision model
export async function read(file: File) {
  if (file.type.startsWith("image/")) return (await ocr([file]))[0];
  if (file.type.startsWith("text/") || plain.test(file.name)) return file.text();
  const bytes = new Uint8Array(await file.arrayBuffer());
  await init();
  try {
    const markdown = toMarkdownBytes(bytes);
    // AnyDoc keeps pictures inside documents but cannot read them; PDFs have no document model
    const pictures = (formatFromBytes(bytes) === "pdf" ? [] : toDocument(bytes).assets).filter((asset) => asset.mediaType.startsWith("image/") && asset.data.length > small).slice(0, most);
    if (!pictures.length) return markdown;
    const texts = await ocr(pictures.map((asset) => new Blob([asset.data as Uint8Array<ArrayBuffer>], { type: asset.mediaType })));
    return `${markdown}\n\n${texts.map((value, index) => `## Picture ${index + 1}\n\n${value}`).join("\n\n")}`;
  } catch (error) {
    const { code, pages: scanned, pageCount } = error as { code?: string; pages: number[]; pageCount: number };
    if (code !== "needsOcr") throw error;
    // Scanned pages go to the vision model, the rest keep their text layer
    const shown = scanned.slice(0, most);
    const typed = Array.from({ length: pageCount }, (_, index) => index + 1).filter((number) => !scanned.includes(number));
    const [seen, written] = [await ocr(await render(bytes, shown)), await text(bytes, typed)];
    const all = [...shown, ...typed].sort((a, b) => a - b);
    return pages(all, all.map((number) => (shown.includes(number) ? seen[shown.indexOf(number)] : written[typed.indexOf(number)])));
  }
}
