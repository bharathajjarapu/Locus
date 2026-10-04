import type { ChatCompletionMessage, ChatCompletionTool, ChatCompletionToolCall } from "@wllama/wllama/esm/index.js";
import { atom } from "@/lib/atom";
import { engine } from "@/lib/engine";
import { find, models, options, own, setOptions, setOwn, type Model } from "@/lib/models";

export type Turn = ChatCompletionMessage;
export type Stats = { speed: number; tokens: number };
type State = {
  model: Model;
  think: boolean;
  busy: boolean;
  status: "idle" | "loading" | "ready" | "error";
  progress: number;
  error?: string;
};

const wllama = engine();
// The model selected in saved options
const active = () => find(options().model);
const store = atom<State>({ model: active(), think: options().think && active().think, busy: false, status: "idle", progress: 0 });
const { get, set: update } = store;
export const useModel = store.use;
let loading: Promise<void> | undefined;
let gpu = false;

// The OPFS folder holding the dropped model files
const folder = async (create = false) => (await navigator.storage.getDirectory()).getDirectoryHandle("own", { create });

// Reads the dropped model files back from OPFS
async function files() {
  const list: File[] = [];
  for await (const handle of (await folder()).values()) if (handle.kind === "file") list.push(await handle.getFile());
  return list;
}

// Downloads the model once (cached in OPFS afterwards) and loads it on GPU or CPU
export function load() {
  loading ??= (async () => {
    const { id, repo, file, mmproj } = active();
    update({ model: active(), status: "loading", progress: 0, error: undefined });
    try {
      const { compute } = options();
      const adapter = compute === "cpu" ? null : await navigator.gpu?.requestAdapter().catch(() => null);
      // ponytail: auto picks GPU by vendor only, since small models run slower on most integrated GPUs; add a speed test if it misjudges
      gpu = !!adapter && (compute === "gpu" || ["nvidia", "apple"].includes(adapter.info?.vendor));
      const config = {
        n_ctx: options().n_ctx,
        // wllama defaults to half the cores; all of them decode ~60% faster, but reading images hangs with more than two
        ...(!gpu && { n_gpu_layers: 0, n_threads: mmproj ? 2 : navigator.hardwareConcurrency }),
      };
      if (id === "own") {
        await wllama.loadModel(await files(), config);
        // What a dropped model can do is read from its chat template
        const template = wllama.getChatTemplate() ?? "";
        setOwn({ tools: template.includes("tools"), think: template.includes("enable_thinking") });
      } else {
        await wllama.loadModelFromHF({ repo, file, mmprojFile: mmproj }, { ...config, progressCallback: ({ loaded, total }) => update({ progress: total ? loaded / total : 0 }) });
      }
      update({ model: active(), status: "ready", progress: 1 });
    } catch (error) {
      loading = undefined;
      update({ status: "error", error: String(error) });
      throw error;
    }
  })();
  return loading;
}

// Loads without throwing; failures show up in the model state
export const preload = () => load().catch(() => {});

// Frees the engine after any load in progress finishes, so two loads never share it
async function unload() {
  await loading?.catch(() => {});
  await wllama.exit();
  loading = undefined;
}

// Swaps to another model, applying its recommended sampling
export async function pick(id: string) {
  const next = find(id);
  setOptions({ ...options(), ...next.preset, model: next.id, think: next.think });
  await unload();
  update({ model: next, think: next.think, status: "idle", progress: 0, error: undefined });
  await preload();
}

// Copies dropped GGUF files into OPFS and switches to them; an mmproj file among them adds vision
export async function adopt(dropped: File[]) {
  const ggufs = dropped.filter((item) => item.name.toLowerCase().endsWith(".gguf"));
  const main = ggufs.find((item) => !/mmproj/i.test(item.name));
  if (!main) throw new Error("Drop a .gguf model file");
  await unload();
  update({ status: "loading", progress: 0 });
  try {
    await remove("own").catch(() => {});
    const target = await folder(true);
    for (const item of ggufs) await item.stream().pipeTo(await (await target.getFileHandle(item.name, { create: true })).createWritable());
  } catch (error) {
    update({ status: "error", error: String(error) });
    throw error;
  }
  const size = ggufs.reduce((sum, item) => sum + item.size, 0);
  setOwn({ name: main.name.replace(/\.gguf$/i, ""), size: `${Math.round(size / 1e6)} MB`, mmproj: ggufs.some((item) => item !== main && /mmproj/i.test(item.name)) ? "mmproj" : undefined, tools: false, think: false });
  await pick("own");
}

// Turns the model's thinking on or off
export function toggleThink() {
  setOptions({ ...options(), think: !get().think });
  update({ think: !get().think });
}

// Whether the selected model can call tools
export const canCallTools = () => active().tools;

// Whether the selected model can look at pictures
export const canSee = () => !!active().mmproj;

// Names what the loaded model runs on
export const backend = () => (gpu ? "WebGPU" : `CPU · ${wllama.getNumThreads()} threads`);

// Lists the downloaded copies of the catalog models
const stored = async () => {
  const copies = await wllama.modelManager.getModels();
  return models.map((item) => ({ id: item.id, copy: copies.find((entry) => entry.url.includes(item.file)) }));
};

// Lists the ids of downloaded models, including a dropped one
export const cached = async () => (await stored()).filter((item) => item.copy).map((item) => item.id).concat(own() ? "own" : []);

// Deletes one model's downloaded weights
export async function remove(id: string) {
  if (id === "own") {
    await (await navigator.storage.getDirectory()).removeEntry("own", { recursive: true });
    return setOwn(null);
  }
  await (await stored()).find((item) => item.id === id)?.copy?.remove();
}

// Marks the model busy while a task runs, so it cannot be swapped underneath it
export async function exclusive<T>(task: () => Promise<T>) {
  update({ busy: true });
  try {
    return await task();
  } finally {
    update({ busy: false });
  }
}

type Request = {
  turns: Turn[];
  signal: AbortSignal;
  onText: (text: string, stats?: Stats, thought?: string) => void;
  limit?: number;
  think?: boolean;
  tools?: ChatCompletionTool[];
};

// Streams one reply, calling onText with the full text so far, and returns any tool calls the model made
export async function reply({ turns, signal, onText, limit, think = false, tools }: Request) {
  await load();
  let text = "";
  let thought = "";
  const calls: ChatCompletionToolCall[] = [];
  // Everything left after the app-only settings is passed to the model as sampling
  const { n_ctx, compute, model: id, think: saved, ...sampling } = options();
  await wllama.createChatCompletion({
    ...sampling,
    ...(limit && { max_tokens: limit }),
    messages: turns,
    ...(tools?.length && { tools }),
    ...(active().think && { chat_template_kwargs: { enable_thinking: think } }),
    stream: true,
    abortSignal: signal,
    onData: (chunk) => {
      const delta = chunk.choices[0]?.delta as ((typeof chunk.choices)[number]["delta"] & { reasoning_content?: string }) | undefined;
      text += delta?.content ?? "";
      thought += delta?.reasoning_content ?? "";
      // Tool calls arrive in pieces, keyed by index
      for (const piece of delta?.tool_calls ?? []) {
        const call = (calls[piece.index] ??= { id: "", type: "function", function: { name: "", arguments: "" } });
        call.id ||= piece.id ?? "";
        call.function.name += piece.function?.name ?? "";
        call.function.arguments += piece.function?.arguments ?? "";
      }
      const timings = chunk.timings;
      onText(text, timings && { speed: timings.predicted_per_second, tokens: timings.predicted_n }, thought);
    },
  });
  return calls.filter(Boolean).map((call, index) => ({ ...call, id: call.id || `call_${index}` }));
}

// Asks the model for a two-word chat title from the first message
export async function nameChat(text: string, signal: AbortSignal) {
  let out = "";
  const system = "Name the user's message with exactly 2 words. Reply with the 2 words only.\nExample: How do I bake bread -> Baking Bread";
  await exclusive(() =>
    reply({
      turns: [
        { role: "system", content: system },
        { role: "user", content: text.slice(0, 300) },
      ],
      signal,
      onText: (full) => (out = full),
      limit: 8,
    }),
  );
  const words = out.split("\n")[0].match(/[\p{L}\p{N}']+/gu) ?? [];
  return words.slice(0, 2).join(" ");
}
