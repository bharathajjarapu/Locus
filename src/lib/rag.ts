import { atom } from "@/lib/atom";
import { all, del, put } from "@/lib/db";
import { embed } from "@/lib/embed";
import { bm25, fuse, split } from "@/lib/rank";

type Chunk = { text: string; vector: Float32Array };
type Doc = { id: string; name: string; size: number; chunks: Chunk[] };

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
export async function add(name: string, content: string) {
  store.set({ indexing: name });
  try {
    const texts = split(content);
    const vectors = await embed(texts);
    const doc: Doc = { id: crypto.randomUUID(), name, size: content.length, chunks: texts.map((text, index) => ({ text, vector: vectors[index] })) };
    await put(doc);
    const list = [...(await load()), doc];
    docs = Promise.resolve(list);
    publish(list);
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

// Finds the chunks most relevant to a query by keywords and meaning together
export async function search(query: string, limit = 4) {
  const chunks = (await load()).flatMap((doc) => doc.chunks.map((chunk) => ({ ...chunk, name: doc.name })));
  if (!chunks.length) return [];
  const [vector] = await embed([query], true);
  const meaning = chunks.map((chunk) => chunk.vector.reduce((sum, value, i) => sum + value * vector[i], 0));
  const score = fuse([
    bm25(
      query,
      chunks.map((chunk) => chunk.text),
    ),
    meaning,
  ]);
  return chunks
    .map((chunk, i) => ({ name: chunk.name, text: chunk.text, score: score[i] }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

void load();
