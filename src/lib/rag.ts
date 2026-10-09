import { atom } from "@/lib/atom";
import { all, del, put } from "@/lib/db";
import { embed } from "@/lib/embed";
import { bm25, fuse, spans } from "@/lib/rank";
import type { Page } from "@/lib/pdf";
import type { Source } from "@/lib/store";

export type Chunk = { text: string; vector: Float32Array; page?: number; start?: number; end?: number; scanned?: boolean };
export type Doc = { id: string; name: string; size: number; chunks: Chunk[]; file?: Blob; text?: string };

// A stable citation identifies a document and one original passage.
const cite = (doc: Doc, index: number): Source => {
  const { vector, ...chunk } = doc.chunks[index];
  return { ...chunk, id: `${doc.id}/${index}`, doc: doc.id, name: doc.name, chunk: index + 1 };
};

// What the library UI shows for each document
export type Entry = { id: string; name: string; size: number; chunks: number };

const store = atom({ entries: [] as Entry[], indexing: "" });
export const useLibrary = store.use;
let docs: Promise<Doc[]> | undefined;

// Publishes the document list to the UI
const publish = (list: Doc[]) => store.set({ entries: list.map(({ id, name, size, chunks }) => ({ id, name, size, chunks: chunks.length })) });

// Loads documents from IndexedDB once
const load = () => (docs ??= all<Doc>().then((list) => (publish(list), list)));

// How many documents are in the library
export const count = () => store.get().entries.length;

// Chunks and embeds a document's text, then saves it to the library
export async function add(name: string, content: string, pdf?: { file: Blob; pages: Page[] }, inline = false) {
  store.set({ indexing: name });
  try {
    const chunks = pdf ? pdf.pages.flatMap((page) => spans(page.text).map((chunk) => ({ ...chunk, page: page.number, scanned: page.scanned }))) : spans(content);
    const vectors = inline ? [] : await embed(chunks.map((chunk) => chunk.text));
    const doc: Doc = { id: crypto.randomUUID(), name, size: content.length, chunks: chunks.map((chunk, index) => ({ ...chunk, vector: vectors[index] ?? new Float32Array() })), ...(pdf ? { file: pdf.file } : { text: content }) };
    await put(doc);
    const list = [...(await load()), doc];
    docs = Promise.resolve(list);
    publish(list);
    return inline ? doc.chunks.map((_, index) => cite(doc, index)) : [];
  } finally {
    store.set({ indexing: "" });
  }
}

// Deletes a document from the library
export async function remove(id: string) {
  await del(id);
  const list = (await load()).filter((doc) => doc.id !== id);
  docs = Promise.resolve(list);
  publish(list);
}

// Dot product of two unit vectors, which is their cosine similarity
export const cosine = (a: Float32Array, b: Float32Array) => a.reduce((sum, value, i) => sum + value * b[i], 0);

// Orders items by keywords and meaning together, keeping the best few
export async function rank<T extends Chunk>(query: string, items: T[], limit: number) {
  if (!items.length) return [];
  const [vector] = await embed([query], true);
  const score = fuse([
    bm25(
      query,
      items.map((item) => item.text),
    ),
    items.map((item) => cosine(item.vector, vector)),
  ]);
  return items
    .map((item, i) => ({ item, score: score[i] }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((hit) => hit.item);
}

// Finds the chunks most relevant to a query
export async function search(query: string, limit = 4) {
  const chunks = (await load()).flatMap((doc) => doc.chunks.map((chunk, index) => ({ ...chunk, ...cite(doc, index) })));
  return rank(query, chunks, limit);
}

void load();
