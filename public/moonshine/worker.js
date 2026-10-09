// Copies WASM string views because Chromium rejects resizable buffers.
const decode = TextDecoder.prototype.decode;
TextDecoder.prototype.decode = function (input, options) {
  if (ArrayBuffer.isView(input) && input.buffer.resizable) input = new Uint8Array(input.buffer, input.byteOffset, input.byteLength).slice();
  return decode.call(this, input, options);
};
const random = crypto.getRandomValues.bind(crypto);
// Fills a fixed buffer before copying random bytes into WASM memory.
crypto.getRandomValues = function (input) {
  if (!input.buffer.resizable) return random(input);
  const fixed = new input.constructor(input.length);
  random(fixed);
  input.set(fixed);
  return input;
};
importScripts("./libwhisper.js");

const base = "https://huggingface.co/cstr/moonshine-tiny-GGUF/resolve/f9d70fd5b08609291b0e1e41a69eed04e3f30009/";
let engine;

// Downloads pinned weights once, falling back to an uncached fetch if storage is unavailable.
async function asset(name, size) {
  const url = base + name;
  const cache = await caches.open("locus-moonshine-q8-v1").catch(() => undefined);
  const saved = await cache?.match(url).catch(() => undefined);
  const response = saved ?? await fetch(url);
  if (!response.ok) throw new Error(`Voice download failed (${response.status}). Try again.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length !== size) {
    await cache?.delete(url).catch(() => {});
    throw new Error("The voice download was incomplete. Try again.");
  }
  if (!saved) await cache?.put(url, new Response(bytes)).catch(() => {});
  return bytes;
}

// Loads Moonshine or transcribes a bounded phrase on one CPU thread.
onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      const [wasm, model, tokenizer] = await Promise.all([
        fetch("./libwhisper.wasm").then((response) => {
          if (!response.ok) throw new Error("Couldn't load the voice runtime.");
          return response.arrayBuffer();
        }),
        asset("moonshine-tiny-q8_0.gguf", 33881056),
        asset("tokenizer.bin", 251254),
      ]);
      const compiled = await WebAssembly.compile(wasm);
      const options = {
        print: () => {}, printErr: () => {},
        instantiateWasm(imports, receive) {
          const instance = new WebAssembly.Instance(compiled, imports);
          const memory = Object.values(instance.exports).find((value) => value instanceof WebAssembly.Memory);
          Object.defineProperty(options, "HEAPU8", { get: () => new Uint8Array(memory.buffer) });
          receive(instance, compiled);
          return instance.exports;
        },
      };
      engine = await whisper_factory(options);
      engine.FS_createDataFile("/", "model.bin", model, true, true, true);
      engine.FS_createDataFile("/", "tokenizer.bin", tokenizer, true, true, true);
      if (!engine.asrOpen("/model.bin", "moonshine", 1)) throw new Error("Couldn't open Moonshine.");
      engine.FS_unlink("/model.bin");
      engine.FS_unlink("/tokenizer.bin");
      postMessage({ type: "ready" });
    } else if (data.type === "audio") {
      const { samples, rate } = data;
      if (!(samples instanceof Float32Array) || !Number.isFinite(rate) || rate < 8000 || samples.length > rate * 15) throw new Error("Invalid voice audio.");
      const audio = new Float32Array(Math.floor(samples.length * 16000 / rate));
      for (let index = 0; index < audio.length; index++) {
        const position = index * rate / 16000;
        const start = Math.floor(position);
        const fraction = position - start;
        audio[index] = samples[start] * (1 - fraction) + (samples[Math.min(start + 1, samples.length - 1)] * fraction);
      }
      const text = Array.from(engine.asrTranscribe(audio, "en"), (segment) => segment.text).join(" ").trim();
      postMessage({ type: "text", text });
    } else if (data.type === "finish") {
      engine.asrClose();
      postMessage({ type: "finished" });
    }
  } catch (error) {
    postMessage({ type: "error", error: error.message || String(error) });
  }
};
