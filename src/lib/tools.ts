import type { ChatCompletionTool } from "@wllama/wllama/esm/index.js";
import { count, search } from "@/lib/rag";

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
