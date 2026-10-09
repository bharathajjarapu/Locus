export type Page = { number: number; text: string; scanned?: boolean };
export type Size = { number: number; width: number; height: number };

// Reads page dimensions without rendering, keeping continuous scroll positions stable.
export async function dimensions(pdf: import("pdfjs-dist").PDFDocumentProxy): Promise<Size[]> {
  return Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
    const number = index + 1;
    const { width, height } = (await pdf.getPage(number)).getViewport({ scale: 1 });
    return { number, width, height };
  }));
}

// Loads pdf.js and its worker only when a PDF is used.
export const load = async (bytes: Uint8Array, signal?: AbortSignal) => {
  signal?.throwIfAborted();
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  signal?.throwIfAborted();
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const cancel = () => { void task.destroy().catch(() => {}); };
  signal?.addEventListener("abort", cancel, { once: true });
  try { return await task.promise; }
  finally { signal?.removeEventListener("abort", cancel); }
};

// Extracts page text in the same order used by the viewer's text layer.
export async function extract(bytes: Uint8Array): Promise<Page[]> {
  const pdf = await load(bytes);
  try {
    const pages: Page[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const { items } = await (await pdf.getPage(number)).getTextContent();
      const text = items.flatMap((item) => "str" in item ? [item.str] : []).join(" ");
      pages.push({ number, text, ...(!text.trim() && { scanned: true }) });
    }
    return pages;
  } finally { await pdf.loadingTask.destroy(); }
}

// Maps a passage's offsets to partial text runs, including repeated text.
export function ranges(strings: string[], start: number, end: number) {
  let offset = 0;
  return strings.flatMap((text, index) => {
    const from = Math.max(0, start - offset);
    const to = Math.min(text.length, end - offset);
    offset += text.length + 1;
    return to > from ? [{ index, start: from, end: to }] : [];
  });
}

// Renders pages (1-indexed) to PNG images
export async function render(bytes: Uint8Array, pages: number[]) {
  const pdf = await load(bytes);
  const images: Blob[] = [];
  try {
    for (const number of pages) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = new OffscreenCanvas(viewport.width, viewport.height);
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
      images.push(await canvas.convertToBlob({ type: "image/png" }));
    }
    return images;
  } finally { await pdf.loadingTask.destroy(); }
}
