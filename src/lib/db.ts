import type { Doc, Entry } from "@/lib/rag";

let opened: Promise<IDBDatabase> | undefined;

// Keeps document names and sizes separate from their text and vectors.
const entry = ({ id, name, size, chunks }: Doc): Entry => ({ id, name, size, chunks: chunks.length });

// Opens the database and backfills the directory once for older libraries.
const open = () =>
  (opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("locus", 3);
    request.onupgradeneeded = () => {
      for (const name of ["docs", "memory"]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" });
      const entries = request.result.createObjectStore("entries", { keyPath: "id" });
      const cursor = request.transaction!.objectStore("docs").openCursor();
      cursor.onsuccess = () => {
        if (!cursor.result) return;
        entries.put(entry(cursor.result.value));
        cursor.result.continue();
      };
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opened = undefined; };
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  }));

// Runs one request against a store
async function run<T>(table: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const transaction = (await open()).transaction(table === "docs" && mode === "readwrite" ? ["docs", "entries"] : table, mode);
  let request: IDBRequest<T>;
  try { request = action(transaction.objectStore(table)); }
  catch (error) { transaction.abort(); throw error; }
  return new Promise<T>((resolve, reject) => {
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error ?? request.error);
  });
}

// Reads every stored document
export const all = <T>(table = "docs") => run<T[]>(table, "readonly", (store) => store.getAll());

// Reads one stored document without loading the whole library.
export const get = <T>(id: string, table = "docs") => run<T | undefined>(table, "readonly", (store) => store.get(id));

// Saves a document, replacing one with the same id
export const put = (doc: { id: string }, table = "docs") => run(table, "readwrite", (store) => {
  const request = store.put(doc);
  if (table === "docs") store.transaction.objectStore("entries").put(entry(doc as Doc));
  return request;
});

// Deletes a document
export const del = (id: string, table = "docs") => run(table, "readwrite", (store) => {
  const request = store.delete(id);
  if (table === "docs") store.transaction.objectStore("entries").delete(id);
  return request;
});
