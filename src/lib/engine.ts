import { LoggerWithoutDebug, Wllama } from "@wllama/wllama/esm/index.js";
import wasm from "@wllama/wllama/esm/wasm/wllama.wasm?url";

// Creates a separate wllama instance, so each model runs in its own worker
export const engine = () => new Wllama({ default: wasm }, { logger: LoggerWithoutDebug });
