// With bun dev running: agent-browser eval "import('/src/lib/engine.test.ts').then(module => module.check())"
import { engine } from "./engine";
import { cached } from "./llm";

// Checks lazy engines stay independent and concurrent cache reads share the chat engine.
export async function check() {
  const [chat, embedder] = await Promise.all([engine(), engine()]);
  if (chat === embedder) throw new Error("Models shared an engine");
  const [first, second] = await Promise.all([cached(), cached()]);
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error("Concurrent cache reads disagreed");
  await Promise.all([chat.exit(), embedder.exit()]);
  return "Lazy engine checks passed";
}
