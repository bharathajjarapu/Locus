// Run against a production preview: bun scripts/storage.ts [label] [--check]. Requires agent-browser.
import { mkdir, rm } from "node:fs/promises";

const label = process.argv[2] ?? "storage";
let session = "";
// Runs commands against this benchmark's private browser.
async function browser(...args: string[]) {
  const child = Bun.spawn(["agent-browser", "--session", session, "--allowed-domains", "localhost", "--json", ...args], { stdout: "pipe", stderr: "pipe" });
  const [output, error, status] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (status) throw new Error(error || output);
  const result = JSON.parse(output);
  if (!result.success) throw new Error(JSON.stringify(result));
  return result.data;
}

// Seeds a large library and saved history.
async function seed() {
  localStorage.clear();
  localStorage.setItem("onboardingComplete", "true");
  localStorage.setItem("activeChatId", "long");
  localStorage.setItem("chatTabs", JSON.stringify([{ id: "long", name: "Long history" }, { id: "short", name: "Short history" }]));
  const messages = Array.from({ length: 3000 }, (_, index) => ({ id: String(index), role: index % 2 ? "assistant" : "user", content: `Message ${index}: ` + "Saved content. ".repeat(32) }));
  localStorage.setItem("chat_long", JSON.stringify(messages));
  localStorage.setItem("chat_short", JSON.stringify(messages.slice(0, 2)));
  const request = indexedDB.open("locus");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const transaction = db.transaction(db.objectStoreNames.contains("entries") ? ["docs", "entries"] : ["docs"], "readwrite");
  for (let index = 0; index < 32; index++) {
    transaction.objectStore("docs").put({
      id: `document-${index}`, name: `Document ${index}`, size: 500000,
      text: "Saved document text. ".repeat(25000),
      chunks: Array.from({ length: 500 }, () => ({ text: "Indexed passage. ".repeat(32), vector: new Float32Array(1536).fill(.01) })),
    });
    if (db.objectStoreNames.contains("entries")) transaction.objectStore("entries").put({ id: `document-${index}`, name: `Document ${index}`, size: 500000, chunks: 500 });
  }
  await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error); });
  db.close();
}

// Counts redundant history writes and document payloads cloned into startup JavaScript.
function probe() {
  const stats = { writes: 0, stringify: 0, libraryBytes: 0, libraryRead: 0, content: 0 };
  Object.assign(window, { __storage: stats });
  const stringify = JSON.stringify;
  JSON.stringify = function (...args: Parameters<typeof JSON.stringify>) {
    const start = performance.now();
    const result = stringify.apply(JSON, args);
    if (Array.isArray(args[0]) && args[0][0]?.role) stats.stringify += performance.now() - start;
    return result;
  };
  const save = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) { if (key === "chat_long") stats.writes++; return save.call(this, key, value); };
  const all = IDBObjectStore.prototype.getAll;
  IDBObjectStore.prototype.getAll = function (...args: Parameters<IDBObjectStore["getAll"]>) {
    const start = performance.now();
    const request = all.apply(this, args);
    if (this.name === "docs") request.addEventListener("success", () => {
      stats.libraryRead += performance.now() - start;
      stats.libraryBytes += request.result.reduce((sum, doc) => sum + (doc.text?.length ?? 0) * 2 + doc.chunks.reduce((size: number, chunk: { text: string; vector: Float32Array }) => size + chunk.text.length * 2 + chunk.vector.byteLength, 0), 0);
    });
    return request;
  };
  const observer = new MutationObserver(() => {
    if (!document.querySelector('[data-slot="message"]:last-child .prose')?.textContent?.includes("Message 2999")) return;
    stats.content = performance.now(); observer.disconnect();
  });
  observer.observe(document, { subtree: true, childList: true });
}

const init = `/tmp/locus-storage-${process.pid}.js`;
await Bun.write(init, `(${probe.toString()})();`);
try {
  const samples = [];
  for (let run = 0; run < 5; run++) {
    session = `locus-storage-${process.pid}-${run}`;
    await browser("open", "--init-script", init);
    await browser("open", "http://localhost:4173");
    await browser("eval", `(${seed.toString()})()`);
    await browser("open", "http://localhost:4173/?storage");
    await browser("wait", "--fn", "window.__storage.content > 0");
    // Allow outstanding startup database reads to finish before taking the sample.
    await browser("wait", "1000");
    const before = (await browser("eval", "({...window.__storage})")).result;
    const files = (await browser("eval", `(async () => {
      const click = text => Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === text).click();
      click('Settings');
      while (!document.querySelector('input[placeholder="Your name"]')) await new Promise(resolve => setTimeout(resolve, 10));
      const start = performance.now(); click('Files');
      while (!document.body.textContent.includes('Document 31')) {
        if (performance.now() - start > 10000) throw new Error('Library did not load');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return performance.now() - start;
    })()`)).result;
    samples.push({ ...before, files });
    console.log(JSON.stringify(samples.at(-1)));
    await browser("close");
  }
  const summary = Object.fromEntries(Object.keys(samples[0]).map(key => [key, samples.map(sample => sample[key]).sort((left, right) => left - right)[2]]));
  await mkdir("bench", { recursive: true });
  await Bun.write(`bench/${label}.json`, JSON.stringify({ label, date: new Date().toISOString(), summary, samples }, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
  if (process.argv.includes("--check") && samples.some(sample => sample.writes !== 0 || sample.libraryBytes !== 0)) throw new Error("Startup rewrote history or loaded document bodies");
} finally { await browser("close"); await rm(init, { force: true }); }
