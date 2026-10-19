// shortcut: npm lacks Bonsai transforms, return to its assets when a compatible release ships.
import wasm from "@/assets/wllama/engine.wasm?url";
import compat from "@/assets/wllama/compat.wasm?url";
import worker from "@/assets/wllama/worker.js?url";

// Creates a separate wllama instance, so each model runs in its own worker
export async function engine() {
  const { LoggerWithoutDebug, Wllama } = await import("@wllama/wllama/esm/index.js");
  const model = new Wllama({ default: wasm }, { logger: LoggerWithoutDebug });
  model.setCompat({ worker, wasm: compat });
  return model;
}
