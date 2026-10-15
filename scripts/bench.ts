// Run against a production preview: bun scripts/bench.ts [label] [url] [--check] [--fonts]. Requires agent-browser.
import { mkdir, rm } from "node:fs/promises";

const label = process.argv[2] ?? "current";
const fonts = process.argv.includes("--fonts");
const url = process.argv[3]?.startsWith("http") ? process.argv[3] : `http://localhost:${fonts ? 4180 : 4173}`;
// Replays a slow font stylesheet against the same production build.
const server = fonts ? Bun.serve({
  hostname: "127.0.0.1", port: 4180,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const headers = { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "credentialless" };
    if (path === "/fonts.css") {
      await Bun.sleep(1000);
      return new Response("/* Delayed benchmark font stylesheet. */", { headers: { ...headers, "Content-Type": "text/css" } });
    }
    if (path === "/") {
      const html = (await Bun.file("dist/index.html").text()).replace(/https:\/\/fonts.googleapis.com[^"]+/, "/fonts.css");
      return new Response(html, { headers: { ...headers, "Content-Type": "text/html" } });
    }
    const file = Bun.file(new URL(`../dist${path}`, import.meta.url));
    const exists = await file.exists();
    return new Response(exists ? file : "Not found", { status: exists ? 200 : 404, headers });
  },
}) : undefined;
let session = `locus-bench-${process.pid}`;

// Runs the browser CLI in an isolated session.
async function browser(...args: string[]) {
  const child = Bun.spawn(["agent-browser", "--session", session, "--allowed-domains", new URL(url).hostname, "--json", ...args], { stdout: "pipe", stderr: "pipe" });
  const [output, error, status] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (status) throw new Error(error || output);
  const result = JSON.parse(output);
  if (!result.success) throw new Error(JSON.stringify(result));
  return result.data;
}

// Seeds synthetic chats only in this script's private browser session.
function seed() {
  localStorage.clear();
  localStorage.setItem("onboardingComplete", "true");
  localStorage.setItem("activeChatId", "long");
  localStorage.setItem("chatTabs", JSON.stringify([{ id: "long", name: "Long history" }, { id: "short", name: "Short history" }]));
  const messages = Array.from({ length: 1000 }, (_, index) => ({
    id: `message-${index}`, role: index % 2 ? "assistant" : "user",
    content: index % 2 ? `## Answer ${index}\n\n` + "A saved answer with **formatted content**, details and a useful explanation. ".repeat(16) + `\n\n\`\`\`ts\nconst answer = ${index};\nconsole.log(answer);\n\`\`\`\n\nThe formula is $x^2 + y^2$.\n\n**End ${index}**` : `Question ${index}: explain the saved result.`,
  }));
  const text = Array.from({ length: 80 }, (_, index) => `Paragraph ${index + 1}: complete saved document.`).join("\n\n");
  const passage = "Paragraph 70: complete saved document.";
  const source = { id: "bench-doc/0", doc: "bench-doc", name: "bench.md", chunk: 1, text: passage, start: text.indexOf(passage), end: text.indexOf(passage) + passage.length };
  Object.assign(messages.at(-1)!, { sources: [source], content: messages.at(-1)!.content + "\n\n[1](locus:bench-doc/0)" });
  const request = indexedDB.open("locus");
  request.onupgradeneeded = () => {
    for (const name of ["docs", "memory"]) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" });
  };
  request.onsuccess = () => {
    const transaction = request.result.transaction(request.result.objectStoreNames.contains("entries") ? ["docs", "entries"] : ["docs"], "readwrite");
    transaction.objectStore("docs").put({ id: "bench-doc", name: "bench.md", size: text.length, chunks: [], text });
    if (request.result.objectStoreNames.contains("entries")) transaction.objectStore("entries").put({ id: "bench-doc", name: "bench.md", size: text.length, chunks: 0 });
    transaction.oncomplete = () => request.result.close();
  };
  localStorage.setItem("chat_long", JSON.stringify(messages));
  localStorage.setItem("chat_short", JSON.stringify(messages.slice(0, 2)));
}

// Records first content paint before the app loads in a fresh browser.
function startup() {
  if (window.top !== window) return;
  seed();
  const observer = new MutationObserver(() => {
    if (!document.querySelector('[data-slot="message"]:last-child .prose')?.textContent?.includes("End 999")) return;
    observer.disconnect();
    Object.assign(window, { __content: performance.now() });
    requestAnimationFrame(() => requestAnimationFrame(() => Object.assign(window, { __startup: performance.now() })));
  });
  observer.observe(document, { childList: true, subtree: true });
}

// Measures real production screens with deterministic local history and no model downloads.
async function measure() {
  const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
  seed();
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;inset:0;width:1280px;height:800px;border:0;z-index:9999;background:white";
  localStorage.setItem("activeChatId", "long");
  const start = performance.now();
  iframe.src = "/?bench";
  document.body.append(iframe);
  await new Promise<void>((resolve) => iframe.onload = () => resolve());
  const win = iframe.contentWindow!;
  const doc = iframe.contentDocument!;
  const frame = () => new Promise<void>((resolve) => win.requestAnimationFrame(() => resolve()));
  // Polls the actual content, then allows a paint to complete.
  const wait = async (ready: () => boolean) => {
    const start = performance.now();
    while (!ready()) { if (performance.now() - start > 15000) throw new Error("Content did not load"); await frame(); }
    await frame(); await frame();
  };
  const last = () => doc.querySelector('[data-slot="message"]:last-child .prose')?.textContent?.includes("End 999") ?? false;
  await wait(last);
  const startup = performance.now() - start;
  const nodes = doc.querySelectorAll("*").length;
  const fonts = doc.querySelector<HTMLLinkElement>("#fonts");
  assert(!fonts?.sheet || fonts.media === "all", "Downloaded fonts were never applied");
  const click = (text: string) => {
    const button = Array.from(doc.querySelectorAll("button")).find((button) => button.textContent?.trim() === text);
    assert(button, `Missing button: ${text}`); button!.click();
  };
  // Times the click through painted content, including panel and chat mounting.
  const time = async (action: () => void, ready: () => boolean) => {
    const start = performance.now(); action(); await wait(ready); return performance.now() - start;
  };
  const settings = await time(() => click("Settings"), () => !!doc.querySelector('input[placeholder="Your name"]'));
  const panels: Record<string, number> = {};
  for (const [name, selector] of [["Persona", 'textarea'], ["Skills", 'button'], ["Models", 'button'], ["Tools", 'button'], ["Files", 'input[type="file"]'], ["General", 'input[placeholder="Your name"]']]) {
    panels[name] = await time(() => click(name), () => !!doc.querySelector(`[role="tabpanel"]:not([hidden]) ${selector}`));
  }
  doc.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')?.click();
  await wait(() => !doc.querySelector('[role="dialog"]'));
  const source = await time(() => doc.querySelector<HTMLButtonElement>('[data-source]')!.click(), () => !!doc.querySelector('[aria-label="Document source"] mark[data-highlight]'));
  doc.querySelector<HTMLButtonElement>('button[aria-label="Close document"]')!.click();
  await wait(() => !doc.querySelector('[aria-label="Document source"]'));
  await time(() => click("Short history"), () => !!doc.querySelector('[data-slot="message"]:last-child .prose')?.textContent?.includes("End 1"));
  const history = await time(() => click("Long history"), last);
  const textarea = doc.querySelector<HTMLTextAreaElement>('textarea')!;
  const type = () => {
    Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "typing a message");
    textarea.dispatchEvent(new win.Event("input", { bubbles: true }));
  };
  const input = await time(type, () => textarea.value === "typing a message");
  const scroller = doc.querySelector<HTMLElement>(".overflow-y-auto.fade")!;
  assert(scroller, "Missing chat scroller");
  const intervals = [];
  let previous = performance.now();
  for (let index = 0; index < 90; index++) {
    scroller.scrollTop = Math.max(0, scroller.scrollTop - 320);
    await frame();
    const now = performance.now(); intervals.push(now - previous); previous = now;
  }
  intervals.sort((left, right) => left - right);
  const batches = [];
  for (let batch = 0; batch < 100; batch++) {
    const button = Array.from(doc.querySelectorAll("button")).find((button) => button.textContent?.includes("Load earlier"));
    if (!button) break;
    const count = doc.querySelectorAll('[data-slot="message"]').length;
    batches.push(await time(() => button.click(), () => doc.querySelectorAll('[data-slot="message"]').length > count));
  }
  assert(doc.querySelectorAll('[data-slot="message"]').length === 1000, "Older history was inaccessible");
  const fullInput = await time(() => {
    Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "typing with all history open");
    textarea.dispatchEvent(new win.Event("input", { bubbles: true }));
  }, () => textarea.value === "typing with all history open");
  const result = { startup, settings, source, panels, history, input, fullInput, earlier: batches.length ? batches.sort((left, right) => left - right)[Math.floor(batches.length / 2)] : null, scroll95: intervals[Math.floor(intervals.length * .95)], scrollMax: intervals.at(-1), nodes };
  assert(JSON.parse(localStorage.getItem("chat_long")!).length === 1000, "History was lost");
  iframe.remove();
  return result;
}

const init = `/tmp/locus-bench-${process.pid}.js`;
await Bun.write(init, `(() => { const seed = ${seed.toString()}; (${startup.toString()})(); })()`);
try {
  const samples = [];
  for (let run = 0; run < 5; run++) {
    session = `locus-bench-${process.pid}-${run}`;
    await browser("open", "--init-script", init);
    await browser("open", url);
    await browser("wait", "--fn", "window.__startup > 0");
    const cold = await browser("eval", "({painted:window.__startup, content:window.__content, ready:performance.getEntriesByType(\"navigation\")[0].domContentLoadedEventEnd, styles:performance.getEntriesByType(\"resource\").filter(entry => entry.initiatorType === \"link\").map(entry => ({name:entry.name, duration:entry.duration}))})");
    await browser("eval", 'document.getElementById("root").style.display = "none"');
    const result = await browser("eval", `(() => { const seed = ${seed.toString()}; return (${measure.toString()})(); })()`);
    samples.push({ ...result.result, cold: cold.result.painted, timing: cold.result });
    console.log(`Sample ${run + 1}: ${Math.round(cold.result.painted)} ms cold startup, ${Math.round(result.result.history)} ms to reopen`);
    await browser("close");
  }
  const median = (values: number[]) => [...values].sort((left, right) => left - right)[Math.floor(values.length / 2)];
  const summary = Object.fromEntries(["cold", "startup", "settings", "source", "history", "input", "fullInput", "scroll95", "scrollMax", "nodes"].map((key) => [key, Math.round(median(samples.map((sample: Record<string, number>) => sample[key])) * 10) / 10]));
  summary.panels = Object.fromEntries(Object.keys(samples[0].panels).map((key) => [key, Math.round(median(samples.map((sample: { panels: Record<string, number> }) => sample.panels[key])) * 10) / 10]));
  await mkdir("bench", { recursive: true });
  await Bun.write(`bench/${label}.json`, JSON.stringify({ label, url, date: new Date().toISOString(), summary, samples }, null, 2) + "\n");
  console.log(JSON.stringify({ label, ...summary }, null, 2));
  if (process.argv.includes("--check") && (summary.startup > 500 || summary.history > 150 || summary.source > 200)) throw new Error("Exceeded the 500 ms startup / 150 ms reopen / 200 ms source budget");
} finally { await browser("close"); await rm(init, { force: true }); server?.stop(true); }
