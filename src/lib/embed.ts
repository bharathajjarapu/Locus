import { atom } from "@/lib/atom";
import { engine } from "@/lib/engine";

export const embedding = { name: "mdbr-leaf-ir", size: "25 MB", repo: "Savyasaachin/mdbr-leaf-ir-Q8_0-GGUF", file: "mdbr-leaf-ir-q8_0.gguf" };
// The GGUF has no projection layer, so it is applied here; this matches MongoDB's sentence-transformers model
const dense = "https://huggingface.co/MongoDB/mdbr-leaf-ir/resolve/main/2_Dense/model.safetensors";
// Prefix the model was trained to expect on search queries
const prefix = "Represent this sentence for searching relevant passages: ";

const wllama = engine();
const store = atom({ status: "idle" as "idle" | "loading" | "ready" | "error", progress: 0, error: "" });
export const useEmbedder = store.use;
let loading: Promise<{ weight: Float32Array; bias: Float32Array }> | undefined;

// Reads the projection weights, keeping the download in the Cache API
async function projection() {
  const cache = await caches.open("locus");
  let response = await cache.match(dense);
  if (!response) {
    response = await fetch(dense);
    if (!response.ok) throw new Error("Could not download the embedding projection");
    await cache.put(dense, response.clone());
  }
  const buffer = await response.arrayBuffer();
  const size = Number(new DataView(buffer).getBigUint64(0, true));
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 8, size)));
  const tensor = (name: string) => new Float32Array(buffer.slice(8 + size + header[name].data_offsets[0], 8 + size + header[name].data_offsets[1]));
  return { weight: tensor("linear.weight"), bias: tensor("linear.bias") };
}

// Downloads the embedding model once and loads it on CPU, apart from the chat model
export function ready() {
  loading ??= (async () => {
    store.set({ status: "loading", progress: 0, error: "" });
    try {
      const [weights] = await Promise.all([
        projection(),
        wllama.loadModelFromHF(embedding, {
          embeddings: true,
          n_ctx: 512,
          n_batch: 512,
          n_ubatch: 512,
          n_gpu_layers: 0,
          n_threads: 2,
          progressCallback: ({ loaded, total }) => store.set({ progress: total ? loaded / total : 0 }),
        }),
      ]);
      store.set({ status: "ready", progress: 1 });
      return weights;
    } catch (error) {
      loading = undefined;
      store.set({ status: "error", error: String(error) });
      throw error;
    }
  })();
  return loading;
}

// Embeds texts into unit vectors; queries get the search prefix
// wllama returns one vector for a batch of inputs and can hang on larger ones, so texts go one at a time
export async function embed(texts: string[], query = false) {
  const { weight, bias } = await ready();
  const vectors: Float32Array[] = [];
  for (const text of texts) {
    // embd_normalize -1 asks llama.cpp for the raw pooled vector, which the projection expects
    const { data } = await wllama.createEmbedding({ input: query ? prefix + text : text, embd_normalize: -1 } as { input: string });
    const pooled = data[0].embedding as number[];
    const vector = new Float32Array(bias.length);
    for (let row = 0; row < vector.length; row++) {
      let sum = bias[row];
      for (let column = 0; column < pooled.length; column++) sum += weight[row * pooled.length + column] * pooled[column];
      vector[row] = sum;
    }
    const norm = Math.hypot(...vector) || 1;
    vectors.push(vector.map((value) => value / norm));
  }
  return vectors;
}
