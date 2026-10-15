// In an empty private browser, open /src/lib/db.test.ts then import it and call check().
// Checks the legacy upgrade, atomic directory writes and lazy library updates.
export async function check() {
  const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
  assert(!(await indexedDB.databases()).some((db) => db.name === "locus"), "Use an empty private browser for the migration test");
  const legacy = { id: "legacy", name: "Legacy.pdf", size: 12, chunks: [{ text: "Saved passage", vector: new Float32Array([.5, .5]) }], file: new Blob(["original file"]) };
  const request = indexedDB.open("locus", 2);
  request.onupgradeneeded = () => {
    request.result.createObjectStore("docs", { keyPath: "id" }).put(legacy);
    request.result.createObjectStore("memory", { keyPath: "id" }).put({ id: "fact", text: "Saved fact" });
  };
  await new Promise<void>((resolve, reject) => { request.onsuccess = () => { request.result.close(); resolve(); }; request.onerror = () => reject(request.error); });
  const { all, get, put, del } = await import("./db");
  const { add, count, remove } = await import("./rag");
  const entries = await all<import("./rag").Entry>("entries");
  assert(entries.length === 1 && entries[0]?.chunks === 1 && entries[0].name === legacy.name, "Upgrade did not backfill the directory");
  const doc = await get<typeof legacy>(legacy.id);
  assert(doc?.chunks[0]?.vector[0] === .5 && await doc.file.text() === "original file", "Upgrade changed original document data");
  assert((await get<{ text: string }>("fact", "memory"))?.text === "Saved fact", "Upgrade lost memory");
  const renamed = { ...legacy, name: "Renamed.pdf", chunks: [] };
  await put(renamed);
  assert((await all<import("./rag").Entry>("entries"))[0]?.name === "Renamed.pdf", "Replacement left stale directory data");
  let rejected = false;
  try { await put({ id: "invalid" }); } catch { rejected = true; }
  assert(rejected && !await get("invalid") && !await get("invalid", "entries"), "Failed write partially committed");
  const read = IDBObjectStore.prototype.getAll;
  let bodies = 0;
  IDBObjectStore.prototype.getAll = function (...args: Parameters<IDBObjectStore["getAll"]>) { if (this.name === "docs") bodies++; return read.apply(this, args); };
  let citations: Awaited<ReturnType<typeof add>>;
  try {
    citations = await add("Inline.txt", "A saved inline passage.", undefined, true);
    assert(bodies === 0, "Adding a file loaded every document body");
  } finally { IDBObjectStore.prototype.getAll = read; }
  assert(count() === 2 && (await all("docs")).length === 2, "First lazy add duplicated a document");
  assert(citations.length === 1 && (await get(citations[0]!.doc, "entries")), "Added document lost its directory or citation");
  await remove(citations[0]!.doc);
  assert(count() === 1 && !await get(citations[0]!.doc) && !await get(citations[0]!.doc, "entries"), "Removal left stale document data");
  await del(legacy.id);
  assert((await all("entries")).length === 0, "Deleting a document left its directory entry");
  await del("fact", "memory");
  return "Database upgrade and library checks passed";
}
