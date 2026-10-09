import type { ChatCompletionTool } from "@wllama/wllama/esm/index.js";
import { atom } from "@/lib/atom";
import { count as memories, recall, remember } from "@/lib/memory";
import { count, search } from "@/lib/rag";
import { passage } from "@/lib/prompt";
import { find, read } from "@/lib/web";
import type { Source } from "@/lib/store";

export type Tool = {
  name: string;
  label: string;
  description: string;
  parameters: ChatCompletionTool["function"]["parameters"];
  // Hidden from the model while this returns false
  available?: () => boolean;
  run: (args: Record<string, string>, signal: AbortSignal) => Promise<string | { text: string; sources: Source[] }>;
};

// JSON schema for a tool that takes one text argument
const text = (key: string, description: string) => ({ type: "object" as const, properties: { [key]: { type: "string", description } }, required: [key] });

type Ask = { question: string; options: string[]; answer: (text: string) => void };
const asking = atom({ ask: null as Ask | null });
export const useAsk = asking.use;

// Add a tool by adding an entry here; the agent, permissions and settings pick it up
export const tools: Tool[] = [
  {
    name: "search_library",
    label: "Search library",
    description: "Search the user's uploaded documents. Cite passages using the exact locus: links returned by this tool.",
    parameters: text("query", "What to look for"),
    available: () => count() > 0,
    async run({ query }) {
      const hits = await search(query);
      return hits.length ? {
        text: hits.map(passage).join("\n\n"),
        sources: hits.map(({ vector, ...hit }) => hit),
      } : "No matching passages found.";
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
    name: "ask_user",
    label: "Ask you",
    description: "Ask the user a question when you need their choice or missing details before you can answer well. Offer short options when there are clear choices.",
    parameters: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question to ask" },
        options: { type: "array", items: { type: "string" }, description: "Up to 4 short answers to pick from; leave out for a free answer" },
      },
      required: ["question"],
    },
    // Waits for the user's answer in a dialog; stopping the chat skips it
    run: ({ question, options = "" }, signal) => new Promise((resolve) => {
      const answer = (text: string) => {
        signal.removeEventListener("abort", skip);
        asking.set({ ask: null });
        resolve(text ? `The user answered: ${text}` : "The user skipped the question.");
      };
      const skip = () => answer("");
      signal.addEventListener("abort", skip, { once: true });
      asking.set({ ask: { question, options: options.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 4), answer } });
    }),
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
