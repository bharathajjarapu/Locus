// Run with: bun src/lib/speech.test.ts
import { forgetVoice, phrases, storedVoice } from "./speech";

const text = "# Hello\n\nRead **this** [message](https://example.com) with `care`.\n\n```js\nsecret();\n```\n\nGoodbye.";
const parts = await phrases(text);
if (parts.join(" ") !== "Hello Read this message with care. Goodbye.") throw new Error("Markdown speech changed");
const long = "A long reply should be read completely. ".repeat(100).trim();
const chunks = await phrases(long);
if (chunks.length < 2 || chunks.some((part) => part.length > 160) || chunks.join(" ") !== long) throw new Error("Speech was truncated");
if ((await phrases("```js\nonlyCode();\n```")).length) throw new Error("Code block was spoken");
if ((await phrases("![cat](image.png) **Hello**!")).join(" ") !== "cat Hello!") throw new Error("Image caption was repeated");

// Checks that microphone batches and the final partial batch preserve every sample.
const messages: { samples?: Float32Array; done?: boolean }[] = [];
let capture: { process(inputs: Float32Array[][]): boolean; port: { onmessage(): void } };
const script = await (await fetch(new URL("../../public/moonshine/capture.js", import.meta.url))).text();
new Function("AudioWorkletProcessor", "registerProcessor", script)(
  class { port = { postMessage: (message: typeof messages[number]) => messages.push(message) }; },
  (_name: string, processor: new () => typeof capture) => { capture = new processor(); },
);
const samples = Float32Array.from({ length: 2176 }, (_, index) => index / 2176);
for (let offset = 0; offset < samples.length; offset += 128) capture!.process([[samples.slice(offset, offset + 128)]]);
if (messages.length !== 1 || messages[0].samples?.length !== 2048) throw new Error("Microphone batching changed");
capture!.port.onmessage();
const recorded = messages.flatMap((message) => Array.from(message.samples ?? []));
if (recorded.length !== samples.length || recorded.some((sample, index) => sample !== samples[index])) throw new Error("Microphone audio was truncated");
if (!messages.at(-1)?.done || capture!.process([[new Float32Array(128)]]) !== false) throw new Error("Microphone did not stop");

// Checks voice storage accounting and deletion without touching unrelated caches.
const cache = "locus-moonshine-q8-v1";
const entries = new Map([["model", new Response(new Uint8Array(1000))], ["tokenizer", new Response(new Uint8Array(100))]]);
const stores = new Set([cache, "locus"]);
Object.defineProperty(globalThis, "caches", { value: {
  keys: async () => [...stores],
  open: async () => ({ keys: async () => [...entries.keys()], match: async (key: string) => entries.get(key)!.clone() }),
  delete: async (key: string) => stores.delete(key),
} });
if (await storedVoice() !== 1100) throw new Error("Voice storage size changed");
await forgetVoice();
if (await storedVoice() !== 0 || !stores.has("locus")) throw new Error("Voice deletion removed another cache");
console.log("speech ok");
