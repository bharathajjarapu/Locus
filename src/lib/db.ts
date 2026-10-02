let opened: Promise<IDBDatabase> | undefined;

// Opens the database once, with one store for documents
const open = () =>
  (opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("locus", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("docs", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));

// Runs one request against the documents store
async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const request = action((await open()).transaction("docs", mode).objectStore("docs"));
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Reads every stored document
export const all = <T>() => run<T[]>("readonly", (store) => store.getAll());

// Saves a document, replacing one with the same id
export const put = (doc: { id: string }) => run("readwrite", (store) => store.put(doc));

// Deletes a document
export const del = (id: string) => run("readwrite", (store) => store.delete(id));
