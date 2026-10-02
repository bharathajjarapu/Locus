import { memo, useMemo } from "react";
import katex from "katex";
import { marked } from "marked";
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

const aliases: Record<string, string> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  html: "markup",
  xml: "markup",
  rs: "rust",
  yml: "yaml",
};

// Escapes text for safe use inside HTML
const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    // Raw HTML from the model is shown as text, never executed
    html: ({ text }) => escape(text),
    link({ href, tokens }) {
      const text = this.parser.parseInline(tokens);
      return /^(https?:|mailto:)/i.test(href) ? `<a href="${escape(href)}" target="_blank" rel="noreferrer">${text}</a>` : text;
    },
    code({ text, lang }) {
      const name = (lang ?? "").trim().toLowerCase();
      const id = aliases[name] ?? name;
      const grammar = Prism.languages[id];
      const html = grammar ? Prism.highlight(text, grammar, id) : escape(text);
      return `<pre class="language-${escape(id)}"><code>${html}</code></pre>`;
    },
  },
});

// Renders markdown with KaTeX math kept out of marked's way
function render(source: string) {
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
  return (marked.parse(text, { async: false }) as string).replace(/@@MATH(\d+)@@/g, (_, index) => math[Number(index)]);
}

export default memo(function Markdown({ text }: { text: string }) {
  const html = useMemo(() => render(text), [text]);
  return <div className="prose max-w-none dark:prose-invert prose-code:before:content-none prose-code:after:content-none" dangerouslySetInnerHTML={{ __html: html }} />;
});
