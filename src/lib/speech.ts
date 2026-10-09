import { useEffect, useRef, useState } from "react";
import { atom } from "./atom";

export const speakers = [
  { value: "heartnano", label: "Heart nano · smallest" },
  { value: "amy", label: "Amy" },
  { value: "kristin", label: "Kristin" },
  { value: "hfc", label: "HFC" },
];
const voice = atom({ id: "", playing: false, loading: false, error: "", dictating: false, sizes: {} as Record<string, number> });
export const useVoice = voice.use;
let engine: Promise<import("sanotts-web").SanoTTS> | undefined;
let audio: AudioContext | undefined;
let source: AudioBufferSourceNode | undefined;
let run = 0;

// Returns the size of Moonshine weights saved on this device without downloading them.
export async function storedVoice() {
  const name = "locus-moonshine-q8-v1";
  if (!(await caches.keys()).includes(name)) return 0;
  const cache = await caches.open(name);
  const sizes = await Promise.all((await cache.keys()).map(async (request) => {
    const response = await cache.match(request);
    return response ? (await response.blob()).size : 0;
  }));
  return sizes.reduce((sum, size) => sum + size, 0);
}

// Deletes the dictation download when the microphone is idle.
export async function forgetVoice() {
  if (voice.get().dictating) throw new Error("Stop dictation before deleting its download.");
  await caches.delete("locus-moonshine-q8-v1");
}

// Releases loaded read-aloud voices; later playback loads them again.
export function unloadVoice() {
  stop();
  engine = undefined;
  voice.set({ sizes: {} });
}

// Removes Markdown formatting and splits speech below the runtime's 30-second cap.
export async function phrases(text: string) {
  const { marked } = await import("marked");
  const words: string[] = [];
  marked.walkTokens(marked.lexer(text), (token) => {
    if ((token.type === "text" && !token.tokens) || token.type === "escape" || token.type === "codespan") words.push(token.text);
  });
  const textOnly = words.join(" ").replace(/\s+([.,!?;:])/g, "$1");
  const decoder = typeof document === "undefined" ? undefined : document.createElement("textarea");
  if (decoder) decoder.innerHTML = textOnly.replace(/</g, "&lt;");
  // ponytail: word-sized chunks, sentence-aware scheduling if pauses become distracting.
  return (decoder?.value ?? textOnly).replace(/\s+/g, " ").trim().match(/.{1,160}(?:\s|$)|.{1,160}/g)?.map((part) => part.trim()) ?? [];
}

// Stops the current message, optionally only when its id matches.
export function stop(id?: string) {
  if (id && voice.get().id !== id) return;
  run++;
  source?.stop();
  source = undefined;
  voice.set({ id: "", playing: false, loading: false, error: "" });
}

// Loads the local WASM runtime once and reads one message at a time.
export async function speak(id: string, text: string) {
  stop();
  const current = run;
  voice.set({ id, playing: true, loading: true, error: "" });
  try {
    audio ??= new AudioContext();
    await audio.resume();
    const parts = await phrases(text);
    if (current !== run) return;
    if (!parts.length) throw new Error("There is no readable text in this message.");
    engine ??= import("sanotts-web").then(({ SanoTTS }) => SanoTTS.load({
      assetBase: `${import.meta.env.BASE_URL}${import.meta.env.DEV ? "node_modules/sanotts-web/dist/" : "sano/"}`,
    })).catch((error) => {
      engine = undefined;
      throw error;
    });
    const pending = engine;
    const tts = await pending;
    if (current !== run) return;
    const selected = localStorage.getItem("speaker") ?? "heartnano";
    const speaker = speakers.some((item) => item.value === selected) ? selected : "heartnano";
    const bundle = await tts.loadVoice(speaker);
    if (engine === pending) voice.set({ sizes: { ...voice.get().sizes, [speaker]: bundle.front.byteLength + bundle.dec.byteLength } });
    if (current !== run) return;
    const saved = Number(localStorage.getItem("voiceRate") ?? 1);
    const rate = Number.isFinite(saved) ? Math.min(1.5, Math.max(0.75, saved)) : 1;
    const { playAudio } = await import("sanotts-web");
    for (const part of parts) {
      if (current !== run) return;
      const result = await tts.synthesize(part, { voice: speaker, maxSeconds: 30 });
      if (current !== run) return;
      if (!result.samples.length) throw new Error("The voice returned no audio.");
      const playing = playAudio(result, { audioContext: audio });
      playing.playbackRate.value = rate;
      source = playing;
      voice.set({ loading: false });
      await new Promise<void>((resolve) => {
        playing.onended = () => {
          playing.disconnect();
          if (source === playing) source = undefined;
          resolve();
        };
      });
    }
  } catch (error) {
    if (current === run) voice.set({ error: `Couldn't read aloud. ${error instanceof Error ? error.message : "Try again."}` });
  } finally {
    if (current === run) voice.set({ playing: false, loading: false });
  }
}

// Local English dictation, with model inference isolated in a single-thread worker.
export function useSpeech(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const active = useRef<{ finish(): void; cancel(): void } | null>(null);

  useEffect(() => () => active.current?.cancel(), []);

  // Starts dictation, finishes the final phrase, or cancels a pending model load.
  async function listen() {
    if (active.current) return active.current.finish();
    if (!navigator.mediaDevices?.getUserMedia || !globalThis.AudioWorkletNode) return setError("Local dictation needs microphone access in a supported browser over HTTPS.");
    let worker: Worker | undefined;
    let context: AudioContext | undefined;
    let stream: MediaStream | undefined;
    let capture: AudioWorkletNode | undefined;
    let stopping = false;
    let chunks: Float32Array[] = [];
    let length = 0;
    let voiced = 0;
    let quiet = 0;
    let pending = 0;
    const session = {
      // Releases the microphone, audio graph and WASM heap, discarding late results.
      cancel() {
        if (active.current !== session) return;
        active.current = null;
        stream?.getTracks().forEach((track) => track.stop());
        capture?.disconnect();
        worker?.terminate();
        void context?.close().catch(() => {});
        chunks = [];
        setListening(false);
        setStatus("");
        voice.set({ dictating: false });
      },
      // Flushes captured audio before closing the worker; a second click cancels.
      finish() {
        if (!capture || stopping) return session.cancel();
        stopping = true;
        setStatus("Transcribing…");
        capture.port.postMessage("stop");
        stream?.getTracks().forEach((track) => track.stop());
      },
    };
    active.current = session;
    setListening(true);
    voice.set({ dictating: true });
    setStatus("Loading Moonshine…");
    setError("");

    // Reports an error only for the current session and allows a clean retry.
    function fail(message: string) {
      if (active.current !== session) return;
      session.cancel();
      setError(`Couldn't dictate. ${message}`);
    }

    // Sends one bounded phrase and skips silence instead of transcribing it.
    function flush() {
      if (voiced >= context!.sampleRate * 0.15) {
        if (pending >= 2) return fail("Dictation couldn't keep up. Try shorter phrases.");
        const samples = new Float32Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          samples.set(chunk, offset);
          offset += chunk.length;
        }
        pending++;
        worker!.postMessage({ type: "audio", samples, rate: context!.sampleRate }, [samples.buffer]);
      }
      chunks = [];
      length = voiced = quiet = 0;
    }

    try {
      context = new AudioContext();
      await context.resume();
      if (active.current !== session) return;
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if (active.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const base = `${import.meta.env.BASE_URL}moonshine/`;
      worker = new Worker(`${base}worker.js`);
      worker.onerror = () => fail("The voice worker stopped. Try again.");
      worker.onmessage = async ({ data }) => {
        if (active.current !== session) return;
        try {
          if (data.type === "ready") {
            await context!.audioWorklet.addModule(`${base}capture.js`);
            if (active.current !== session) return;
            capture = new AudioWorkletNode(context!, "capture", { channelCount: 1, channelCountMode: "explicit" });
            capture.onprocessorerror = () => fail("Microphone capture stopped. Try again.");
            capture.port.onmessage = ({ data }) => {
              if (active.current !== session) return;
              if (data.samples) {
                const samples = data.samples as Float32Array;
                chunks.push(samples);
                length += samples.length;
                const energy = samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length;
                // ponytail: fixed silence threshold; use adaptive VAD if noisy rooms need it.
                if (energy > 0.000064) { voiced += samples.length; quiet = 0; }
                else quiet += samples.length;
                if (quiet >= context!.sampleRate * 1.2 || length >= context!.sampleRate * 13) flush();
              }
              if (data.done) {
                flush();
                capture?.disconnect();
                void context?.close().catch(() => {});
                worker?.postMessage({ type: "finish" });
              }
            };
            context!.createMediaStreamSource(stream!).connect(capture);
            capture.connect(context!.destination);
            stream!.getTracks().forEach((track) => { track.onended = () => fail("Microphone access ended. Try again."); });
            setStatus("");
          } else if (data.type === "text") {
            pending--;
            if (data.text) onText(data.text);
          } else if (data.type === "finished") session.cancel();
          else if (data.type === "error") fail(data.error);
        } catch (error) {
          fail(error instanceof Error ? error.message : "Try again.");
        }
      };
      worker.postMessage({ type: "load" });
    } catch (error) {
      fail(error instanceof Error ? error.message : "Try again.");
    }
  }

  return { listening, status, error, listen, dismiss: () => setError("") };
}
