let opened: Promise<IDBDatabase> | undefined;

// Opens the database once, with one store for documents and one for memories
const open = () =>
  (opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("locus", 2);
    request.onupgradeneeded = () => {
      for (const name of ["docs", "memory"]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));

// Runs one request against a store
async function run<T>(table: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const request = action((await open()).transaction(table, mode).objectStore(table));
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Reads every stored document
export const all = <T>(table = "docs") => run<T[]>(table, "readonly", (store) => store.getAll());

// Reads one stored document without loading the whole library.
export const get = <T>(id: string, table = "docs") => run<T | undefined>(table, "readonly", (store) => store.get(id));

// Saves a document, replacing one with the same id
export const put = (doc: { id: string }, table = "docs") => run(table, "readwrite", (store) => store.put(doc));

// Deletes a document
export const del = (id: string, table = "docs") => run(table, "readwrite", (store) => store.delete(id));
