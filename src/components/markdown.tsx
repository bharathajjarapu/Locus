import { memo, useMemo } from "react";
import katex from "katex";
import { Marked } from "marked";
import Prism from "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-css";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-go";
import "prismjs/components/prism-java";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-yaml";
import { show } from "@/components/artifact";
import type { Source } from "@/lib/store";

const aliases: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  html: "markup",
  xml: "markup",
  svg: "markup",
  rs: "rust",
  yml: "yaml",
};

// Escapes text for safe use inside HTML
export const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

// Renders safe Markdown and links only citations supplied with this reply.
export function render(source: string, sources: Source[] = []) {
  const markup = new Marked({
    gfm: true,
    breaks: true,
    renderer: {
      // Raw HTML from the model is shown as text, never executed
      html: ({ text }) => escape(text),
      link({ href, tokens }) {
        const text = this.parser.parseInline(tokens);
        const target = href.replace(/^locus:/i, "locus:");
        const label = text.replace(/^locus:/i, "locus:");
        const index = sources.findIndex((source) => target === `locus:${source.id}` || label === `locus:${source.id}`);
        const source = sources[index];
        if (source) {
          const label = `${source.name}${source.page ? `, page ${source.page}` : ""}`;
          return `<button type="button" data-source="${escape(source.id)}" title="${escape(label)}" aria-label="${escape(`${label}, reference ${index + 1}`)}" class="cursor-pointer rounded bg-muted px-1 text-xs font-medium text-primary align-super">${index + 1}</button>`;
        }
        return /^(https?:|mailto:)/i.test(href) ? `<a href="${escape(href)}" target="_blank" rel="noreferrer">${text}</a>` : text;
      },
      code({ text, lang }) {
        const name = (lang ?? "").trim().toLowerCase();
        const id = aliases[name] ?? name;
        const grammar = Prism.languages[id];
        const html = grammar ? Prism.highlight(text, grammar, id) : escape(text);
        const pre = `<pre class="language-${escape(id)}"><code>${html}</code></pre>`;
        // Web pages and drawings get a button that opens them live in the artifact viewer
        return name === "html" || name === "svg" ? `<div class="relative">${pre}<button type="button" data-preview class="absolute top-2 right-2 rounded-md bg-background px-2 py-1 text-xs font-medium shadow-sm">Preview</button></div>` : pre;
      },
    },
  });

  const math: string[] = [];
  const stash = (tex: string, display: boolean) => {
    math.push(katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false }));
    return `@@MATH${math.length - 1}@@`;
  };
  const text = source
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/g)
    .map((part, index) =>
      index % 2
        ? part
        : part
            .replace(/\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g, (_, a, b) => stash(a ?? b, true))
            .replace(/\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g, (_, a, b) => stash(a ?? b, false)),
    )
    .join("");
  return (markup.parse(text, { async: false }) as string).replace(/@@MATH(\d+)@@/g, (_, index) => math[Number(index)]);
}

export default memo(function Markdown({ text, sources, onSource }: { text: string; sources?: Source[]; onSource?: (source: Source) => void }) {
  const html = useMemo(() => render(text, sources), [text, sources]);
  return (
    <div
      className="prose max-w-none dark:prose-invert prose-code:before:content-none prose-code:after:content-none"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={(event) => {
        const button = (event.target as Element).closest("[data-preview]");
        if (button) show(button.previousElementSibling?.textContent ?? "");
        const citation = (event.target as Element).closest<HTMLButtonElement>("[data-source]");
        const source = sources?.find((source) => source.id === citation?.dataset.source);
        if (source) onSource?.(source);
      }}
    />
  );
});
