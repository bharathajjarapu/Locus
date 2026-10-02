import { useEffect, useState } from "react";

// Sampling recommended by each model's authors, plus reply limit
const liquid = { temperature: 0.1, top_k: 50, top_p: 1, min_p: 0, repeat_penalty: 1.05, max_tokens: 2048 };
const cpm = { temperature: 0.7, top_k: 0, top_p: 0.95, min_p: 0, repeat_penalty: 1, max_tokens: 4096 };

export type Model = {
  id: string;
  name: string;
  size: string;
  repo: string;
  file: string;
  // Image encoder file; a model with one can see pictures
  mmproj?: string;
  think: boolean;
  tools: boolean;
  note: string;
  preset: typeof liquid;
};

export const models: Model[] = [
  { id: "lfm", name: "LFM2.5 230M", size: "149 MB", repo: "LiquidAI/LFM2.5-230M-GGUF", file: "LFM2.5-230M-QAD-Q4_0.gguf", think: false, tools: false, note: "Fast and light", preset: liquid },
  { id: "cpm", name: "MiniCPM5 1B", size: "688 MB", repo: "openbmb/MiniCPM5-1B-GGUF", file: "MiniCPM5-1B-Q4_K_M.gguf", think: true, tools: true, note: "Smarter, can think", preset: cpm },
  { id: "vl", name: "LFM2.5 VL 450M", size: "332 MB", repo: "LiquidAI/LFM2.5-VL-450M-GGUF", file: "LFM2.5-VL-450M-Q4_K_M.gguf", mmproj: "mmproj-LFM2.5-VL-450m-Q8_0.gguf", think: false, tools: false, note: "Sees images, fast", preset: liquid },
];

// Looks up a model by id, falling back to the first
export const find = (id: string) => models.find((item) => item.id === id) ?? models[0];

export const defaults = { ...liquid, n_ctx: 8192, compute: "auto" as "auto" | "gpu" | "cpu", model: "lfm", think: false };
type Options = typeof defaults;

// Reads saved model options over the defaults
export const options = (): Options => ({ ...defaults, ...JSON.parse(localStorage.getItem("modelOptions") ?? "{}") });
// Saves model options; n_ctx and compute apply on the next load
export const setOptions = (value: Options) => localStorage.setItem("modelOptions", JSON.stringify(value));

// Model options as state; each change is saved, and `sync` re-reads them when it changes
export function useOptions(sync?: unknown) {
  const [value, setValue] = useState(options);
  useEffect(() => setValue(options()), [sync]);
  const change = (patch: Partial<Options>) => {
    const next = { ...options(), ...patch };
    setValue(next);
    setOptions(next);
  };
  return [value, change] as const;
}
