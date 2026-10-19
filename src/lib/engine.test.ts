// With bun dev running: agent-browser eval "import('/src/lib/engine.test.ts').then(module => module.check())"
import { engine } from "./engine";
import { cached, canCallTools, canSee, exclusive, reply, thinks, toggleThink, type Turn } from "./llm";
import { options } from "./models";
import { tools } from "./tools";

// Checks lazy engines stay independent and concurrent cache reads share the chat engine.
export async function check() {
  const [chat, embedder] = await Promise.all([engine(), engine()]);
  if (chat === embedder) throw new Error("Models shared an engine");
  const [first, second] = await Promise.all([cached(), cached()]);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error("Concurrent cache reads disagreed");
  await Promise.all([chat.exit(), embedder.exit()]);
  return "Lazy engine checks passed";
}

// With Bonsai loaded, checks its transforms, thinking sampler, tool round-trip and image input.
export const bonsai = () => exclusive(async () => {
  if (options().model !== "bonsai" || thinks() || !canSee() || !canCallTools()) throw new Error("Load Bonsai with thinking off first");
  toggleThink();
  try {
    const preset = options();
    if (!thinks() || preset.temperature !== 1 || preset.top_p !== 0.95 || preset.presence_penalty !== 1) throw new Error("Thinking sampler was not applied");
  } finally {
    toggleThink();
  }
  if (options().temperature !== 0.7 || options().presence_penalty !== 1.5) throw new Error("Normal sampler was not restored");
  const signal = AbortSignal.timeout(300_000);
  let text = "";
  const onText = (value: string) => { text = value; };
  await reply({ turns: [{ role: "user", content: "What is the capital of France? Answer with the city only." }], signal, limit: 16, onText });
  if (!/\bParis\b/i.test(text)) throw new Error(`Bonsai transforms failed: ${text}`);

  const tool = tools.find((item) => item.name === "calculator")!;
  const turns: Turn[] = [{ role: "user", content: "Use the calculator tool to evaluate (12 + 3) * 4. Then reply with the result only." }];
  const calls = await reply({ turns, signal, limit: 96, onText, tools: [{ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } }] });
  if (calls.length !== 1 || calls[0].function.name !== tool.name) throw new Error(`Calculator call was not parsed: ${text}`);
  const result = await tool.run(JSON.parse(calls[0].function.arguments), signal);
  if (result !== "60") throw new Error(`Calculator arguments were wrong: ${JSON.stringify(calls)}`);
  turns.push({ role: "assistant", content: "", tool_calls: calls }, { role: "tool", tool_call_id: calls[0].id, content: result });
  await reply({ turns, signal, limit: 32, onText });
  if (!/\b60\b/.test(text)) throw new Error(`Tool result was not used: ${text}`);

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "red";
  context.fillRect(0, 0, 128, 128);
  const image = await new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!)));
  await reply({ turns: [{ role: "user", content: [{ type: "image", data: await image.arrayBuffer() }, { type: "text", text: "What color fills this image? Answer with one word." }] }], signal, limit: 32, onText });
  if (!/\bred\b/i.test(text)) throw new Error(`Image input failed: ${text}`);
  return "Bonsai text, sampler, tools and vision checks passed";
});
