import wasm from "@wllama/wllama/esm/wasm/wllama.wasm?url";

// Creates a separate wllama instance, so each model runs in its own worker
export async function engine() {
  const { LoggerWithoutDebug, Wllama } = await import("@wllama/wllama/esm/index.js");
  return new Wllama({ default: wasm }, { logger: LoggerWithoutDebug });
}
