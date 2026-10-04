import type { ChatCompletionTool } from "@wllama/wllama/esm/index.js";
import { count as memories, recall, remember } from "@/lib/memory";
import { count, search } from "@/lib/rag";
import { find, read } from "@/lib/web";

export type Tool = {
  name: string;
  label: string;
  description: string;
  parameters: ChatCompletionTool["function"]["parameters"];
  // Hidden from the model while this returns false
  available?: () => boolean;
  run: (args: Record<string, string>) => Promise<string>;
};

// JSON schema for a tool that takes one text argument
const text = (key: string, description: string) => ({ type: "object" as const, properties: { [key]: { type: "string", description } }, required: [key] });

// Add a tool by adding an entry here; the agent, permissions and settings pick it up
export const tools: Tool[] = [
  {
    name: "search_library",
    label: "Search library",
    description: "Search the user's uploaded documents. Use it when the answer may be in their files.",
    parameters: text("query", "What to look for"),
    available: () => count() > 0,
    async run({ query }) {
      const hits = await search(query);
      return hits.length ? hits.map((hit) => `[${hit.name}]\n${hit.text}`).join("\n\n") : "No matching passages found.";
    },
  },
  {
    name: "save_memory",
    label: "Save memory",
    description: "Remember a lasting fact the user told you, such as a preference, name or decision, for future chats. Save one short fact per call, written as \"The user ...\". Never save questions or facts you already know.",
    parameters: text("fact", "The fact to remember, as one sentence"),
    async run({ fact }) {
      if (fact.trim().endsWith("?")) throw new Error("Save facts, not questions");
      return remember(fact.trim());
    },
  },
  {
    name: "search_memory",
    label: "Search memory",
    description: "Search facts saved from earlier chats. Use it when the answer may depend on what you know about the user.",
    parameters: text("query", "What to look for"),
    available: () => memories() > 0,
    async run({ query }) {
      const hits = await recall(query);
      return hits.length ? hits.map((hit) => `- ${hit.text}`).join("\n") : "No matching memories found.";
    },
  },
  {
    name: "search_web",
    label: "Search web",
    description: "Search the web for current or unknown information. Returns titles, links and snippets.",
    parameters: text("query", "What to search for"),
    async run({ query }) {
      const hits = await find(query);
      return hits.length ? hits.map((hit) => `[${hit.title}](${hit.url})\n${hit.snippet}`).join("\n\n") : "No results found.";
    },
  },
  {
    name: "fetch_page",
    label: "Fetch page",
    description: "Read a web page as text. Use it on a link from search_web or one the user gave.",
    parameters: text("url", "The full address of the page"),
    run: ({ url }) => read(url.trim()),
  },
  {
    name: "calculator",
    label: "Calculator",
    description: "Evaluate an arithmetic expression such as (12 + 3) * 4.",
    parameters: text("expression", "The expression to evaluate"),
    async run({ expression }) {
      if (!/^[\d\s+\-*/%().^]+$/.test(expression)) throw new Error("Only numbers and + - * / % ^ ( ) are allowed");
      return String(Function(`"use strict"; return (${expression.replace(/\^/g, "**")})`)());
    },
  },
  {
    name: "datetime",
    label: "Date and time",
    description: "Get the current date and time.",
    parameters: { type: "object", properties: {} },
    run: async () => new Date().toString(),
  },
];
