import { atom } from "@/lib/atom";
import { all, del, put } from "@/lib/db";
import { embed } from "@/lib/embed";
import { cosine, rank, type Chunk } from "@/lib/rag";

type Memory = Chunk & { id: string; at: number };

const store = atom({ memories: [] as Memory[] });
export const useMemory = store.use;
let loaded: Promise<Memory[]> | undefined;

// Loads memories from IndexedDB once
const load = () => (loaded ??= all<Memory>("memory").then((list) => (store.set({ memories: list }), list)));

// Publishes a changed list to the UI and later reads
function publish(list: Memory[]) {
  loaded = Promise.resolve(list);
  store.set({ memories: list });
}

// How many memories are saved
export const count = () => store.get().memories.length;

// Saves a fact, replacing a near-duplicate
export async function remember(text: string) {
  const [vector] = await embed([text]);
  const list = await load();
  const old = list.find((memory) => cosine(memory.vector, vector) > 0.93);
  const memory: Memory = { id: old?.id ?? crypto.randomUUID(), text, vector, at: Date.now() };
  await put(memory, "memory");
  publish([...list.filter((item) => item !== old), memory]);
  return old ? `Updated: ${old.text} → ${text}` : "Saved.";
}

// Deletes a memory
export async function forget(id: string) {
  await del(id, "memory");
  publish((await load()).filter((memory) => memory.id !== id));
}

// Finds the five memories most relevant to a query, skipping the embedder when there are only that many
export async function recall(query: string) {
  const list = await load();
  return list.length <= 5 ? list : rank(query, list, 5);
}

void load();
