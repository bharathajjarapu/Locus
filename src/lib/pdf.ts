// pdf.js loads only when a PDF has scanned pages, since it is large
const load = async (bytes: Uint8Array) => {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
};

// Renders pages (1-indexed) to PNG images
export async function render(bytes: Uint8Array, pages: number[]) {
  const pdf = await load(bytes);
  const images: Blob[] = [];
  for (const number of pages) {
    const page = await pdf.getPage(number);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport }).promise;
    images.push(await canvas.convertToBlob({ type: "image/png" }));
  }
  return images;
}

// Reads the text layer of pages (1-indexed)
export async function text(bytes: Uint8Array, pages: number[]) {
  const pdf = await load(bytes);
  const out: string[] = [];
  for (const number of pages) {
    const { items } = await (await pdf.getPage(number)).getTextContent();
    out.push(items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return out;
}
