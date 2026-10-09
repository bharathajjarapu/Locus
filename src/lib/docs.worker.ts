import init, { formatFromBytes, toDocument, toMarkdownBytes } from "@firecrawl/anydoc-wasm";

// Converts Office files away from chat and releases the WASM when the worker closes.
self.onmessage = async ({ data: { bytes, most, small } }: MessageEvent<{ bytes: Uint8Array; most: number; small: number }>) => {
  try {
    await init();
    if (formatFromBytes(bytes) === "pdf") {
      self.postMessage({ pdf: bytes }, { transfer: [bytes.buffer] });
      return;
    }
    const text = toMarkdownBytes(bytes);
    const pictures = toDocument(bytes).assets.filter((asset) => asset.mediaType.startsWith("image/") && asset.data.length > small).slice(0, most);
    self.postMessage({ text, pictures });
  } catch (error) { self.postMessage({ error: (error as Error).message }); }
};
