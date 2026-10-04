import type { ChatCompletionToolCall } from "@wllama/wllama/esm/index.js";
import { atom } from "@/lib/atom";
import { canCallTools, exclusive, reply, type Turn } from "@/lib/llm";
import { rule, setRule } from "@/lib/rules";
import type { Used } from "@/lib/store";
import { tools, type Tool } from "@/lib/tools";

type Choice = "allow" | "deny" | "always";
type Question = { tool: Tool; args: string; answer: (choice: Choice) => void };

// Most tool rounds before the model has to answer
const rounds = 3;

const store = atom({ question: null as Question | null });
export const usePermit = store.use;

// Answers the open permission question
export const answer = (choice: Choice) => store.get().question?.answer(choice);

// Waits for the user to decide on a tool call; stopping the chat counts as a denial
function ask(tool: Tool, args: string, signal: AbortSignal) {
  return new Promise<Choice>((resolve) => {
    const finish = (choice: Choice) => {
      signal.removeEventListener("abort", deny);
      store.set({ question: null });
      resolve(choice);
    };
    const deny = () => finish("deny");
    signal.addEventListener("abort", deny, { once: true });
    store.set({ question: { tool, args, answer: finish } });
  });
}

// Runs one offered tool call if its rule or the user allows it
async function execute(call: ChatCompletionToolCall, offered: Tool[], signal: AbortSignal): Promise<Used> {
  const tool = offered.find((item) => item.name === call.function.name);
  const used = { name: tool?.label ?? call.function.name, args: call.function.arguments, result: "" };
  if (!tool) return { ...used, result: "Unknown tool." };
  const mode = rule(tool.name);
  const choice = mode === "ask" ? await ask(tool, used.args, signal) : mode === "allow" ? "allow" : "deny";
  if (choice === "deny") return { ...used, result: "The user denied this tool call.", denied: true };
  if (choice === "always") setRule(tool.name, "allow");
  try {
    const args = Object.fromEntries(Object.entries(JSON.parse(used.args || "{}")).map(([key, value]) => [key, String(value)]));
    return { ...used, result: await tool.run(args) };
  } catch (error) {
    return { ...used, result: `Error: ${(error as Error).message}` };
  }
}

type Run = {
  turns: Turn[];
  signal: AbortSignal;
  think: boolean;
  incognito: boolean;
  onText: Parameters<typeof reply>[0]["onText"];
  onTools: (used: Used[]) => void;
};

// Lets the model call tools and read their results until it answers
export const run = ({ turns, signal, think, incognito, onText, onTools }: Run) =>
  exclusive(async () => {
    const offered = canCallTools() ? tools.filter((tool) => tool.available?.() !== false && rule(tool.name) !== "deny" && !(incognito && tool.name === "save_memory")) : [];
    const specs = offered.map(({ name, description, parameters }) => ({ type: "function" as const, function: { name, description, parameters } }));
    const messages = [...turns];
    const used: Used[] = [];
    for (let round = 0; round <= rounds; round++) {
      // The last round offers no tools, so the model must answer
      const calls = await reply({ turns: messages, signal, onText, think, tools: round < rounds ? specs : undefined });
      if (!calls.length) return;
      messages.push({ role: "assistant", content: "", tool_calls: calls });
      for (const call of calls) {
        const done = await execute(call, offered, signal);
        used.push(done);
        onTools([...used]);
        messages.push({ role: "tool", tool_call_id: call.id, content: done.result });
      }
    }
  });
