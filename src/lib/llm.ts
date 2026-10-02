import { useSyncExternalStore } from "react";
import { LoggerWithoutDebug, Wllama } from "@wllama/wllama/esm/index.js";
import wasm from "@wllama/wllama/esm/wasm/wllama.wasm?url";

export const model = {
  name: "LFM2.5 230M",
  size: "149 MB",
  repo: "LiquidAI/LFM2.5-230M-GGUF",
  file: "LFM2.5-230M-QAD-Q4_0.gguf",
};

export type Turn = { role: "system" | "user" | "assistant"; content: string };
export type Stats = { speed: number; tokens: number };
type State = {
  status: "idle" | "loading" | "ready" | "error";
  progress: number;
  error?: string;
};

// Sampling recommended by Liquid AI for LFM2.5, plus reply and context limits
export const defaults = { temperature: 0.1, top_k: 50, top_p: 1, min_p: 0, repeat_penalty: 1.05, max_tokens: 2048, n_ctx: 8192, cpu: true };
export type Options = typeof defaults;

// Reads saved model options over the defaults
export const options = (): Options => ({ ...defaults, ...JSON.parse(localStorage.getItem("modelOptions") ?? "{}") });
// Saves model options; n_ctx and cpu apply on the next load
export const setOptions = (value: Options) => localStorage.setItem("modelOptions", JSON.stringify(value));

const wllama = new Wllama({ default: wasm }, { logger: LoggerWithoutDebug });
const listeners = new Set<() => void>();
let state: State = { status: "idle", progress: 0 };
let loading: Promise<void> | undefined;
let gpu = false;

// Updates the shared model state and notifies subscribers
function update(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

// Subscribes React to the model state
export function useModel() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

// Downloads the model once (cached in OPFS afterwards) and loads it on WebGPU
export function load() {
  loading ??= (async () => {
    update({ status: "loading", progress: 0, error: undefined });
    try {
      gpu = !options().cpu && !!(await navigator.gpu?.requestAdapter().catch(() => null));
      await wllama.loadModelFromHF(
        { repo: model.repo, file: model.file },
        {
          n_ctx: options().n_ctx,
          ...(options().cpu && { n_gpu_layers: 0 }),
          progressCallback: ({ loaded, total }) =>
            update({ progress: total ? loaded / total : 0 }),
        },
      );
      update({ status: "ready", progress: 1 });
    } catch (error) {
      loading = undefined;
      update({ status: "error", error: String(error) });
      throw error;
    }
  })();
  return loading;
}

// Names what the loaded model runs on
export const backend = () => (gpu ? "WebGPU" : `CPU · ${wllama.getNumThreads()} threads`);

// Deletes cached weights so the next load downloads them again
export async function clear() {
  await wllama.exit();
  await wllama.modelManager.clear();
}

// Streams a reply, calling onText with the full text so far
export async function reply(
  turns: Turn[],
  signal: AbortSignal,
  onText: (text: string, stats?: Stats) => void,
  limit?: number,
) {
  await load();
  let text = "";
  const { n_ctx, cpu, ...sampling } = options();
  await wllama.createChatCompletion({
    ...sampling,
    ...(limit && { max_tokens: limit }),
    messages: turns,
    stream: true,
    abortSignal: signal,
    onData: (chunk) => {
      text += chunk.choices[0]?.delta.content ?? "";
      const timings = chunk.timings;
      onText(
        text,
        timings && {
          speed: timings.predicted_per_second,
          tokens: timings.predicted_n,
        },
      );
    },
  });
}

// Asks the model for a short chat title from the first message
export async function nameChat(text: string, signal: AbortSignal) {
  let out = "";
  const system = "Write a title of 3 to 5 words for the user's message. Reply with the title only, no quotes or punctuation.\nExample: How do I bake bread -> Baking Bread at Home";
  await reply([{ role: "system", content: system }, { role: "user", content: text.slice(0, 500) }], signal, (full) => (out = full), 16);
  return out.split("\n")[0].replace(/^["'\s]+|["'.\s]+$/g, "").slice(0, 40);
}
