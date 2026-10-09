// With bun dev running: agent-browser eval "import('/src/components/source.test.tsx').then(module => module.check())"
import { createRoot } from "react-dom/client";
import Source from "./source";
import { put, del } from "@/lib/db";
import type { Doc } from "@/lib/rag";
import type { Source as Citation } from "@/lib/store";

// Checks complete previews, citation highlights, repeated passages, and resizing.
export async function check() {
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:100;background:var(--background);display:flex";
  document.body.append(host);
  const root = createRoot(host);
  const doc: Doc = { id: crypto.randomUUID(), name: "sample.docx", size: 0, chunks: [], text: "# Heading\n\n" + Array.from({ length: 80 }, (_, index) => `Paragraph ${index + 1}: complete document body.`).join("\n\n") + "\n\n| Item | Amount |\n| --- | --- |\n| Energy | 42 |\n\n```js\nconst answer = 42;\n```" };
  // Waits for the asynchronous document load and browser layout.
  const wait = async () => {
    for (let tries = 0; tries < 100; tries++) {
      if (host.querySelector("header h2")?.textContent === doc.name && host.querySelectorAll(".paper-page").length) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Paper preview did not render");
  };
  const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const source: Citation = { id: `${doc.id}/0`, doc: doc.id, name: doc.name, chunk: 1, text: "complete document body.", start: doc.text!.indexOf("Paragraph 70:") + "Paragraph 70: ".length };
  source.end = source.start! + source.text.length;
  // Waits until a changed citation has replaced the previous highlights.
  const marked = async (value: string) => {
    for (let tries = 0; tries < 100; tries++) {
      if (Array.from(host.querySelectorAll("mark[data-highlight]"), (mark) => mark.textContent).join("").replace(/\s/g, "") === value.replace(/\s/g, "")) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Citation highlight did not match its passage");
  };
  try {
    await put(doc);
    root.render(<Source source={source} onClose={() => {}} />);
    await wait();
    assert(host.querySelectorAll(".paper-page").length > 1, "Long document did not paginate");
    assert(host.querySelectorAll(".paper p").length === 80, "Pagination lost or duplicated a paragraph");
    assert(host.querySelector("table")?.textContent?.includes("42") && host.querySelector("pre")?.textContent?.includes("answer"), "Formatting was lost");
    assert(getComputedStyle(host.querySelector(".paper")!).backgroundColor === "rgb(255, 255, 255)", "Paper was not white");
    await marked(source.text);
    assert(host.querySelector("mark")?.closest("p")?.textContent?.startsWith("Paragraph 70:"), "Repeated citation highlighted the wrong occurrence");
    assert(!host.querySelector('[role="tab"]'), "Document and passage were still separated");
    assert(host.querySelector('div[aria-label="Document pages"]')!.scrollTop > 0, "Citation did not scroll into view");
    const next = { ...source, start: doc.text!.indexOf("Paragraph 5:") + "Paragraph 5: ".length };
    next.end = next.start + next.text.length;
    root.render(<Source source={next} onClose={() => {}} />);
    for (let tries = 0; tries < 100 && !host.querySelector("mark")?.closest("p")?.textContent?.startsWith("Paragraph 5:"); tries++) await new Promise((resolve) => setTimeout(resolve, 20));
    assert(host.querySelector("mark")?.closest("p")?.textContent?.startsWith("Paragraph 5:"), "Changing citations retained the old highlight");
    host.style.width = "390px";
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert(host.querySelectorAll(".paper p").length === 80, "Resizing lost paragraphs");
    assert(Array.from(host.querySelectorAll<HTMLElement>(".paper")).every((page) => page.scrollWidth <= page.clientWidth), "Narrow paper overflowed horizontally");
    assert(host.querySelector("mark")?.closest("p")?.textContent?.startsWith("Paragraph 5:"), "Resizing lost the cited occurrence");
    doc.name = "sample.pptx";
    doc.text = Array.from({ length: 50 }, (_, index) => `## Slide ${index + 1}\n\nComplete slide ${index + 1}.`).join("\n\n");
    await put(doc);
    root.render(<Source key="slides" source={{ id: `${doc.id}/0`, doc: doc.id, name: doc.name, chunk: 1, text: "Complete slide 50." }} onClose={() => {}} />);
    await wait();
    assert(host.querySelectorAll(".paper-page").length === 50, "Slide boundaries were lost");
    assert(host.querySelectorAll(".paper p").length === 50 && host.textContent?.includes("Complete slide 50."), "Slide content was lost");
    await marked("Complete slide 50.");
    assert(host.querySelector("mark")?.closest("section")?.getAttribute("aria-label") === "Slide 50", "Citation opened the wrong slide");
    doc.name = "README.md";
    doc.text = "# Heading\n\nStart **bold passage** and tail.\n\n| Item | Amount |\n| --- | --- |\n| Energy | 42 |\n\n```js\nconst ab = 0;\nconst a_b = 42;\n```";
    await put(doc);
    const passage = { ...source, name: doc.name, text: "**bold passage** and tail.", start: doc.text.indexOf("**bold"), end: doc.text.indexOf("tail.") + 5 };
    root.render(<Source key="readme" source={passage} onClose={() => {}} />);
    await wait();
    await marked("bold passageand tail.");
    root.render(<Source key="readme" source={{ ...passage, text: "ge** and tail.", start: doc.text.indexOf("ge**"), end: passage.end }} onClose={() => {}} />);
    await marked("geand tail.");
    root.render(<Source key="readme" source={{ ...passage, text: "| Energy | 42 |", start: doc.text.indexOf("| Energy"), end: doc.text.indexOf("| Energy") + 15 }} onClose={() => {}} />);
    await marked("Energy42");
    root.render(<Source key="readme" source={{ ...passage, text: "a_b = 42;", start: doc.text.indexOf("a_b"), end: doc.text.indexOf("a_b") + 9 }} onClose={() => {}} />);
    await marked("a_b = 42;");
    root.render(<Source key="readme" source={{ ...passage, text: "A passage missing from this document." }} onClose={() => {}} />);
    for (let tries = 0; tries < 100 && host.querySelector("mark"); tries++) await new Promise((resolve) => setTimeout(resolve, 20));
    assert(!host.querySelector("mark") && host.textContent?.includes("could not be located"), "An unmatched citation retained a misleading highlight");
    return "Paper preview checks passed";
  } finally { root.unmount(); host.remove(); await del(doc.id); }
}
