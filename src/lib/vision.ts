import { engine } from "@/lib/engine";
import { find } from "@/lib/models";

// The small vision model from the catalog, so its download is shared with chat
const { repo, file, mmproj: mmprojFile } = find("vl");
const ask = "Describe this image in one or two sentences, then write out any text you can read in it.";

let queue: Promise<unknown> = Promise.resolve();

// Reads images with a small vision model; it loads on demand and is freed afterwards (more than two threads hang on images)
async function run(images: Blob[]) {
  const wllama = engine();
  try {
    await wllama.loadModelFromHF({ repo, file, mmprojFile }, { n_ctx: 4096, n_gpu_layers: 0, n_threads: 2 });
    const texts: string[] = [];
    for (const image of images) {
      const { choices } = await wllama.createChatCompletion({
        messages: [{ role: "user", content: [{ type: "image", data: await image.arrayBuffer() }, { type: "text", text: ask }] }],
        max_tokens: 1024,
        temperature: 0,
      });
      texts.push((choices[0]?.message.content ?? "").trim());
    }
    return texts;
  } finally {
    await wllama.exit();
  }
}

// Reads the text in each image; batches run one at a time so only one vision model is in memory
export function ocr(images: Blob[]) {
  const job = queue.then(() => run(images));
  queue = job.catch(() => {});
  return job;
}
