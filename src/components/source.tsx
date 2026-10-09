import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowExpand01Icon, ArrowShrink01Icon, Cancel01Icon, File01Icon } from "@hugeicons/core-free-icons";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask, TextLayer } from "pdfjs-dist";
import { render } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { get } from "@/lib/db";
import { dimensions, load, ranges, type Size } from "@/lib/pdf";
import type { Doc } from "@/lib/rag";
import type { Source as Citation } from "@/lib/store";

type Rect = { left: number; top: number; width: number; height: number };

// Matches rendered passage text, using stored offsets to distinguish repeated passages.
function highlight(pane: HTMLElement, doc: Doc, source: Citation, slides: boolean, loose = false): HTMLElement | null {
  for (const mark of pane.querySelectorAll("mark[data-highlight]")) {
    const parent = mark.parentNode;
    mark.replaceWith(...mark.childNodes);
    parent?.normalize();
  }
  const clean = (text: string) => text.replace(loose ? /[\s*_`#|[\]]/g : /\s/g, "");
  const fragment = document.createElement("div");
  fragment.innerHTML = render(source.text);
  const target = clean(fragment.textContent ?? "");
  if (!target) return null;
  const nodes: { node: Text; start: number; end: number }[] = [];
  let text = "";
  for (const page of pane.querySelectorAll(slides ? ".paper-page" : ".paper")) {
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      if (node.parentElement?.closest("[data-preview]")) continue;
      const start = text.length;
      text += clean(node.data);
      nodes.push({ node, start, end: text.length });
    }
  }
  const hits: number[] = [];
  for (let offset = text.indexOf(target); offset >= 0; offset = text.indexOf(target, offset + target.length)) hits.push(offset);
  // Chunks can begin or end inside Markdown formatting delimiters.
  if (!hits.length && !loose && (doc.text ?? doc.chunks.map((chunk) => chunk.text).join("\n\n")).includes(source.text)) return highlight(pane, doc, source, slides, true);
  let hit = hits.length === 1 ? hits[0] : undefined;
  const value = doc.text;
  if (hits.length > 1 && value && source.start != null && value.slice(source.start, source.end) === source.text) {
    const offsets: number[] = [];
    for (let offset = value.indexOf(source.text); offset >= 0; offset = value.indexOf(source.text, offset + source.text.length)) offsets.push(offset);
    if (offsets.length === hits.length) hit = hits[offsets.indexOf(source.start)];
  }
  if (hit == null) return null;
  let first: HTMLElement | null = null;
  for (const { node, start, end } of nodes) {
    if (end <= hit || start >= hit + target.length) continue;
    let offset = start;
    let begin = -1;
    let finish = 0;
    for (let index = 0; index < node.length; index++) {
      if (!clean(node.data[index])) continue;
      if (offset >= hit && offset < hit + target.length) { if (begin < 0) begin = index; finish = index + 1; }
      offset++;
    }
    if (begin < 0) continue;
    const range = document.createRange();
    range.setStart(node, begin); range.setEnd(node, finish);
    const mark = document.createElement("mark");
    mark.dataset.highlight = "";
    range.surroundContents(mark);
    first ??= mark;
  }
  return first;
}

// Renders a nearby PDF page and marks its cited text runs.
function Page({ pdf, number, source, onReady }: { pdf: PDFDocumentProxy; number: number; source: Citation; onReady: (top: number) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [rects, setRects] = useState<Rect[]>([]);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(true);
  const [matched, setMatched] = useState(false);
  const ready = useEffectEvent(onReady);

  useEffect(() => {
    const element = host.current!;
    const observer = new ResizeObserver(() => setWidth(Math.floor(element.clientWidth)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!width) return;
    let active = true;
    let task: RenderTask | undefined;
    let layer: TextLayer | undefined;
    let page: PDFPageProxy | undefined;
    const output = canvas.current!;
    const container = text.current!;
    container.replaceChildren();
    setRects([]); setProblem(""); setBusy(true); setMatched(false);

    // Fits the page to the pane and highlights character ranges in its text layer.
    async function draw() {
      page = await pdf.getPage(number);
      if (!active) { page.cleanup(); return; }
      const scale = Math.min(width / page.getViewport({ scale: 1 }).width, 2);
      const viewport = page.getViewport({ scale });
      const ratio = Math.min(devicePixelRatio || 1, 2);
      output.width = Math.ceil(viewport.width * ratio);
      output.height = Math.ceil(viewport.height * ratio);
      output.style.width = `${viewport.width}px`;
      output.style.height = `${viewport.height}px`;
      container.style.setProperty("--total-scale-factor", String(scale * viewport.userUnit));
      const content = await page.getTextContent();
      if (!active) return;
      const { TextLayer } = await import("pdfjs-dist");
      if (!active) return;
      task = page.render({ canvas: output, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      layer = new TextLayer({ container, viewport, textContentSource: content });
      await Promise.all([task.promise, layer.render()]);
      if (!active) return;
      const strings = layer.textContentItemsStr;
      const value = strings.join(" ");
      const exact = number === source.page && !source.scanned && source.start != null && source.end != null && value.slice(source.start, source.end) === source.text;
      let top = 0;
      if (exact) {
        const bounds = container.getBoundingClientRect();
        const marks = ranges(strings, source.start!, source.end!).flatMap((part) => {
          const node = layer!.textDivs[part.index]?.firstChild;
          if (!node || node.nodeType !== Node.TEXT_NODE) return [];
          const range = document.createRange();
          range.setStart(node, part.start); range.setEnd(node, part.end);
          return Array.from(range.getClientRects(), (rect) => ({ left: rect.left - bounds.left, top: rect.top - bounds.top, width: rect.width, height: rect.height }));
        });
        setRects(marks);
        setMatched(marks.length > 0);
        top = marks[0]?.top ?? 0;
      }
      setBusy(false);
      ready(top);
    }
    void draw().catch((error: Error) => { if (active) { setProblem(error.message); setBusy(false); } });
    return () => {
      active = false; task?.cancel(); layer?.cancel();
      void (task?.promise ?? Promise.resolve()).catch(() => {}).then(() => page?.cleanup());
    };
  }, [pdf, number, source, width]);

  return (
    <div ref={host} className="relative h-full w-full">
      {busy && <p role="status" className="absolute inset-x-0 top-0 z-10 bg-background p-3 text-sm">Rendering page…</p>}
      {problem && <p role="alert" className="absolute inset-x-0 top-0 z-10 bg-background p-3 text-sm text-destructive">{problem}</p>}
      {!busy && !problem && number === source.page && !matched && <p className="absolute inset-x-0 top-0 z-10 bg-background p-3 text-sm text-muted-foreground">{source.scanned ? "This scanned page has no text positions for passage highlighting." : "Text positions are unavailable for highlighting this passage."}</p>}
      <div className="relative mx-auto w-fit bg-white">
        <canvas ref={canvas} aria-label={`PDF page ${number}`} className={busy ? "invisible" : "block"} />
        <div ref={text} className="pdf-text" />
        {rects.map((rect, index) => <span key={index} data-highlight aria-hidden="true" className="pointer-events-none absolute bg-yellow-400/40" style={rect} />)}
      </div>
    </div>
  );
}

// Keeps every page in the scroll layout, rendering only pages near the viewport.
function Pdf({ pdf, source }: { pdf: PDFDocumentProxy; source: Citation }) {
  const host = useRef<HTMLDivElement>(null);
  const pending = useRef<number | null>(null);
  const [pages, setPages] = useState<Size[]>([]);
  const [near, setNear] = useState<Set<number>>(new Set());
  const [problem, setProblem] = useState("");
  const fit = useEffectEvent(() => point(false));

  useEffect(() => {
    let active = true;
    void dimensions(pdf).then((pages) => { if (active) setPages(pages); }).catch((error: Error) => { if (active) setProblem(error.message); });
    return () => { active = false; };
  }, [pdf]);
  useEffect(() => {
    if (!pages.length) return;
    const observer = new IntersectionObserver((entries) => {
      setNear((previous) => {
        const next = new Set(previous);
        for (const entry of entries) {
          const number = Number((entry.target as HTMLElement).dataset.page);
          if (entry.isIntersecting) next.add(number); else next.delete(number);
        }
        return next;
      });
    }, { root: host.current, rootMargin: "400px 0px" });
    for (const element of host.current!.querySelectorAll("[data-page]")) observer.observe(element);
    let width = 0;
    const resize = new ResizeObserver(([entry]) => {
      const next = Math.floor(entry.contentRect.width);
      if (next !== width) { width = next; fit(); }
    });
    resize.observe(host.current!);
    return () => { observer.disconnect(); resize.disconnect(); };
  }, [pages]);

  // Scrolls within the PDF pane without moving the surrounding chat.
  function scroll(number: number, top = 0) {
    const pane = host.current;
    const element = pane?.querySelector<HTMLElement>(`[data-page="${number}"]`);
    if (pane && element) pane.scrollTo({ top: Math.max(0, pane.scrollTop + element.getBoundingClientRect().top - pane.getBoundingClientRect().top + top - 80) });
  }
  // Points to the passage immediately if rendered, or once its page is ready.
  function point(exact = true) {
    const number = source.page ?? 1;
    pending.current = number;
    const element = host.current?.querySelector<HTMLElement>(`[data-page="${number}"]`);
    const mark = exact ? element?.querySelector<HTMLElement>("[data-highlight]") : null;
    scroll(number, mark && element ? mark.getBoundingClientRect().top - element.getBoundingClientRect().top : 0);
    if (mark) pending.current = null;
  }
  useEffect(() => { if (pages.length) point(false); }, [source, pages]);

  return <>
    <nav aria-label="PDF pages" className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
      <span className="text-sm text-muted-foreground">{pdf.numPages} pages</span>
      <Button variant="ghost" size="sm" onClick={() => point()}>Show highlight</Button>
    </nav>
    <div ref={host} aria-label="Original PDF pages" className="min-h-0 flex-1 overflow-auto bg-muted p-3 [overflow-anchor:none]">
      {problem ? <p role="alert" className="text-destructive">{problem}</p> : !pages.length ? <p role="status">Loading pages…</p> : pages.map((page) => <section key={page.number} className="mb-4 last:mb-0" aria-label={`Page ${page.number}`}>
        <p className="mb-2 text-center text-xs text-muted-foreground">Page {page.number}</p>
        <div data-page={page.number} className="mx-auto w-full bg-white" style={{ aspectRatio: `${page.width} / ${page.height}`, maxWidth: page.width * 2 }}>
          {near.has(page.number) && <Page pdf={pdf} number={page.number} source={source} onReady={(top) => {
            if (pending.current === page.number) { scroll(page.number, top); pending.current = null; }
          }} />}
        </div>
      </section>)}
    </div>
  </>;
}

// Lays out converted documents on paper sheets and presentations on slide sheets.
function Paper({ doc, source }: { doc: Doc; source: Citation }) {
  const host = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [matched, setMatched] = useState(true);
  const slides = /\.(pptx?|ppsx?|potx?)$/i.test(doc.name);
  const html = useMemo(() => render(doc.text ?? doc.chunks.map((chunk) => chunk.text).join("\n\n")), [doc]);
  // Highlights the current citation and scrolls only the document pane.
  function point() {
    const pane = host.current;
    if (!pane?.querySelector(".paper-page")) return;
    const mark = highlight(pane, doc, source, slides);
    setMatched(!!mark);
    if (mark) pane.scrollTo({ top: Math.max(0, pane.scrollTop + mark.getBoundingClientRect().top - pane.getBoundingClientRect().top - 80) });
  }
  const ready = useEffectEvent(point);

  useEffect(() => { point(); }, [source]);

  useEffect(() => {
    const pane = host.current!;
    let frame = 0;
    let width = 0;
    // Measures formatted blocks once and moves them into full, unclipped sheets.
    function layout() {
      const next = Math.floor(pane.clientWidth - 24);
      if (next <= 0 || next === width) return;
      width = next;
      pane.replaceChildren();
      const flow = document.createElement("div");
      flow.className = "paper prose";
      flow.style.width = `${slides ? 960 : Math.min(width, 794)}px`;
      flow.innerHTML = html;
      pane.append(flow);
      const blocks = Array.from(flow.children, (block) => ({ block, height: block.getBoundingClientRect().height + parseFloat(getComputedStyle(block).marginTop) + parseFloat(getComputedStyle(block).marginBottom) }));
      const capacity = (slides ? 540 : Math.min(width, 794) * 297 / 210) - 96;
      let sheet: HTMLDivElement | undefined;
      let used = 0;
      let total = 0;
      for (const { block, height } of blocks) {
        const heading = slides && block.tagName === "H2" && /^Slide \d+$/.test(block.textContent ?? "");
        if (!sheet || heading || (!slides && used > 0 && used + height > capacity)) {
          const page = document.createElement("section");
          const label = `${slides ? "Slide" : "Page"} ${++total}`;
          page.setAttribute("aria-label", label);
          page.className = "paper-page";
          const caption = document.createElement("p");
          caption.className = "mb-2 text-center text-xs text-muted-foreground";
          caption.textContent = label;
          sheet = document.createElement("div");
          sheet.className = "paper prose";
          sheet.style.width = flow.style.width;
          sheet.style.minHeight = `${capacity + 96}px`;
          if (slides) sheet.style.zoom = String(Math.min(width / 960, 1.5));
          page.append(caption, sheet);
          pane.append(page);
          used = 0;
        }
        if (heading) { block.remove(); continue; }
        // ponytail: oversized blocks grow the sheet; split rows only if fixed pagination is needed.
        sheet.append(block);
        used += height;
      }
      flow.remove();
      setCount(total);
      ready();
    }
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(layout); });
    observer.observe(pane);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [html, slides]);

  return <>
    <nav aria-label="Document pages" className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
      <span className="text-xs text-muted-foreground">{count ? `${count} ${slides ? "slide" : "page"}${count === 1 ? "" : "s"} · ` : ""}Reflowed preview · original layout may differ{!matched && <span role="status" className="block">This passage could not be located in the preview.</span>}</span>
      <Button variant="ghost" size="sm" onClick={() => point()}>Show highlight</Button>
    </nav>
    <div ref={host} aria-label={slides ? "Presentation slides" : "Document pages"} className="min-h-0 flex-1 overflow-auto bg-muted p-3" />
  </>;
}

// Shows the original document alongside chat, with its exact retrieved passage.
export default function Source({ source, onClose }: { source: Citation; onClose: () => void }) {
  const [loaded, setLoaded] = useState<{ id: string; doc: Doc; pdf?: PDFDocumentProxy } | null>(null);
  const [problem, setProblem] = useState("");
  const [wide, setWide] = useState(false);
  const current = loaded?.id === source.doc ? loaded : null;
  const close = useEffectEvent(onClose);

  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") close(); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);

  useEffect(() => {
    let active = true;
    let pdf: PDFDocumentProxy | undefined;
    const controller = new AbortController();
    setProblem("");
    // Opens the stored PDF once; changing passages in the same file reuses it.
    async function open() {
      const doc = await get<Doc>(source.doc);
      if (!active) return;
      if (!doc) throw new Error("This document was deleted. Re-upload it to view this citation.");
      if (doc.file) pdf = await load(new Uint8Array(await doc.file.arrayBuffer()), controller.signal);
      if (!active) { await pdf?.loadingTask.destroy(); return; }
      setLoaded({ id: source.doc, doc, pdf });
    }
    void open().catch((error: Error) => { if (active) setProblem(error.message); });
    return () => { active = false; controller.abort(); void pdf?.loadingTask.destroy().catch(() => {}); };
  }, [source.doc]);

  return (
    <aside aria-label="Document source" className={`absolute inset-0 z-30 flex min-h-0 min-w-0 flex-col border-l bg-background md:static md:w-[45%] md:max-w-2xl md:shrink-0 ${wide ? "lg:w-[65%] lg:max-w-none" : ""}`}>
      <header className="flex items-center gap-2 border-b p-3">
        <HugeiconsIcon icon={File01Icon} className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-medium" title={source.name}>{source.name}</h2>
          {source.page && <p className="text-xs text-muted-foreground">Page {source.page}</p>}
        </div>
        <Button variant="ghost" size="icon" className="hidden lg:inline-flex" aria-label={wide ? "Narrow document" : "Expand document"} title={wide ? "Narrow document" : "Expand document"} aria-pressed={wide} onClick={() => setWide(!wide)}>
          <HugeiconsIcon icon={wide ? ArrowShrink01Icon : ArrowExpand01Icon} />
        </Button>
        <Button autoFocus variant="ghost" size="icon" aria-label="Close document" title="Close document" onClick={onClose}><HugeiconsIcon icon={Cancel01Icon} /></Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        {problem ? <p role="alert" className="p-4 text-destructive">{problem}</p> : !current ? <p role="status" className="p-4">Loading document…</p> : current.pdf ? <Pdf key={source.doc} pdf={current.pdf} source={source} /> : /\.pdf$/i.test(current.doc.name) ? <p className="p-4 text-muted-foreground">This older upload has no saved PDF. Re-upload the file and ask again to view its original pages.</p> : <Paper key={source.doc} doc={current.doc} source={source} />}
      </div>
    </aside>
  );
}
