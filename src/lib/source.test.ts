// Run with: bun src/lib/source.test.ts
import { render } from "@/components/markdown";
import { spans } from "./rank";
import { dimensions, ranges } from "./pdf";
import { withFiles } from "./prompt";
import type { Source } from "./store";

// Fails when a source position, citation, or snapshot is wrong.
const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const text = "  Same sentence. Same sentence.\n\nA final paragraph.  ";
const chunks = spans(text, 18);
for (const chunk of chunks) check(text.slice(chunk.start, chunk.end) === chunk.text, "Passage offsets changed text");
check(chunks[1].start > chunks[0].end, "Repeated passage matched its first occurrence");
check(JSON.stringify(ranges(["Same", "Same", "last"], 6, 9)) === JSON.stringify([{ index: 1, start: 1, end: 4 }]), "Partial repeated run mapped incorrectly");
const source: Source = { id: "document/1", doc: "document", name: "notes.pdf", chunk: 2, page: 1, text: chunks[1].text, start: chunks[1].start, end: chunks[1].end };
const valid = render("Supported [notes](locus:document/1). Invented [other](locus:missing/0).", [source]);
check(!render("[Passage 2](locus:document/1)", [source]).includes(">Passage 2<"), "Verbose passage label still visible");
check(render("[Passage 2](locus:document/1)", [source]).includes('align-super">1</button>'), "Citation lost its compact reference number");
check(render("[Locus:document/1](https://example.com)", [source]).includes('data-source="document/1"'), "Known source label kept the model's wrong external URL");
check(!render("[Locus:missing/0](https://example.com)", [source]).includes("data-source"), "Invented source label became clickable");
check(valid.includes('data-source="document/1"') && !valid.includes('data-source="missing/0"'), "Unverified citation became clickable");
check(!render("[notes](locus:document/1)").includes("data-source"), "Citation leaked between renders");
check(!render('<script>alert(1)</script> [bad](javascript:alert)').includes("<script>"), "Unsafe source markup rendered");
check(withFiles({ id: "user", role: "user", content: "Explain", files: [{ name: source.name, text, sources: [source] }] }).includes(`(locus:${source.id})\n${source.text}`), "Inline PDF lost its source link");
check(JSON.parse(JSON.stringify(source)).start === source.start, "Citation position lost on reload");

// Builds a small original PDF with repeated lines on two pages.
function fixture() {
  const content = "BT /F1 18 Tf 50 750 Td (Same sentence.) Tj 0 -30 Td (Same sentence.) Tj 0 -30 Td (Plants convert sunlight into food.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate 90 /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.7\n";
  const offsets = objects.map((object, index) => { const offset = pdf.length; pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; return offset; });
  const start = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

// Uses pdf.js's already-installed optional Node canvas, without a browser.
const { createCanvas, DOMMatrix, ImageData, Path2D } = await import("@napi-rs/canvas");
Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import("pdfjs-dist");
pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
const bytes = fixture();
const pdf = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true }).promise;
try {
  check(pdf.numPages === 2, "Original PDF page count wrong");
  const pages = await dimensions(pdf);
  check(pages.length === pdf.numPages && pages[0].width === 612 && pages[0].height === 792 && pages[1].width === 792 && pages[1].height === 612, "Continuous PDF layout lost a page or its rotation");
  for (const number of [1, 2]) {
    const page = await pdf.getPage(number);
    const { items } = await page.getTextContent();
    const strings = items.flatMap((item) => "str" in item ? [item.str] : []);
    const text = strings.join(" ");
    const start = text.lastIndexOf("Same sentence.");
    const selected = ranges(strings, start, start + 14);
    check(selected.map((part) => strings[part.index].slice(part.start, part.end)).join("") === "Same sentence.", "PDF passage does not match its text runs");
    const viewport = page.getViewport({ scale: 1 });
    check(number === 1 ? viewport.width === 612 : viewport.width === 792, "Rotated PDF dimensions wrong");
    const canvas = createCanvas(viewport.width, viewport.height);
    for (const stage of ["first render", "return after cleanup"]) {
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
      const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
      check(pixels.some((value, index) => index % 4 !== 3 && value < 100), `Original PDF blank on ${stage}`);
      check(page.cleanup(), "Off-screen page could not release its resources");
    }
  }
} finally { await pdf.loadingTask.destroy(); }

// Exercises the real upload reader with Vite's asset URL and optional Office fixtures.
const module = "bun:test";
const { mock } = await import(module);
const runtime = globalThis as unknown as { process: { argv: string[] }; Bun: { file: (path: string) => Blob & { name: string } } };
mock.module("pdfjs-dist/build/pdf.worker.min.mjs?url", () => ({ default: pdfjs.GlobalWorkerOptions.workerSrc }));
mock.module("./vision", () => ({ ocr: async () => { throw new Error("Text fixtures unexpectedly requested OCR"); } }));
const { read } = await import("./docs");
const upload = await read(new File([bytes], "sample.pdf", { type: "application/pdf" }));
check(upload.pages?.length === 2 && upload.pages.every((page) => page.text.includes("Plants convert sunlight")), "PDF upload lost readable pages");
check((await read(new File([bytes], "sample.bin"))).pages?.length === 2, "PDF detection lost pages through the Office worker");
const markdown = "# Heading\n\n| Item | Amount |\n| --- | --- |\n| Energy | 42 |\n\n```js\nconst answer = 42;\n```";
check((await read(new File([markdown], "sample.md"))).text === markdown, "Markdown upload changed formatting");
check(render(markdown).includes("<table>") && render(markdown).includes("<h1>") && render(markdown).includes("<pre"), "Markdown preview lost headings, tables, or code");
let saved: { text?: string } | undefined;
mock.module("./db", () => ({ all: async () => [], del: async () => {}, put: async (doc: { text?: string }) => { saved = structuredClone(doc); } }));
mock.module("./embed", () => ({ embed: async () => { throw new Error("Small document unexpectedly loaded the embedder"); } }));
const { add } = await import("./rag");
await add("sample.md", markdown, undefined, true);
check(saved?.text === markdown, "Saved document replaced its complete formatting with retrieval chunks");
let rejected = false;
try { await read(new File(["Invalid Office bytes"], "broken.docx")); } catch { rejected = true; }
check(rejected, "Office worker failed to report an unreadable file");
for (const path of runtime.process.argv.slice(2)) {
  const file = runtime.Bun.file(path);
  const start = performance.now();
  const content = await read(new File([await file.arrayBuffer()], path.split("/").at(-1)!));
  check(content.text.includes("Complete document body.") && content.text.includes("Final document sentence."), "Office upload lost document content");
  check(/\.pptx$/.test(path) ? content.text.includes("## Slide 50") : render(content.text).includes("<table>"), "Office preview lost slides or tables");
  console.log(`${file.name}: converted in ${(performance.now() - start).toFixed(0)} ms`);
}
console.log("sources ok · original PDF pages rendered without a browser");
