import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Pick } from "@/components/pick";
import { Voice } from "@/components/voice";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { embedding, useEmbedder } from "@/lib/embed";
import { adopt, backend, cached, measure, pick, preload, remove, useModel } from "@/lib/llm";
import { models, options, own, useOptions } from "@/lib/models";

// Sampling controls shown as sliders
const sliders = [
  { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.05 },
  { key: "top_k", label: "Top K", min: 0, max: 100, step: 1 },
  { key: "top_p", label: "Top P", min: 0, max: 1, step: 0.05 },
  { key: "min_p", label: "Min P", min: 0, max: 1, step: 0.01 },
  { key: "repeat_penalty", label: "Repeat penalty", min: 1, max: 2, step: 0.01 },
  { key: "max_tokens", label: "Max reply length", min: 128, max: 8192, step: 128 },
] as const;

const contexts = [2048, 4096, 8192, 16384, 32768].map((value) => ({ value, label: `${value / 1024}K tokens` }));

// Context size the model was loaded with this page session
const loaded = options().n_ctx;

// Compact model picker, drop zone for your own GGUF, embedding model and sampling sliders.
export function Model() {
  const { model, status, progress, busy, error } = useModel();
  const [opts, change] = useOptions(model.id);
  const embedder = useEmbedder();
  const [saved, setSaved] = useState<string[]>([]);
  const [problem, setProblem] = useState("");
  const [selected, setSelected] = useState(model.id);
  const items = models.concat(own() ?? []);
  const chosen = items.find((item) => item.id === selected) ?? model;
  const current = chosen.id === model.id;
  const have = saved.includes(chosen.id);

  // Refreshes which models are downloaded
  const refresh = () => void cached().then(setSaved).catch((error: Error) => setProblem(error.message));
  useEffect(refresh, [status, model.id]);
  useEffect(() => setSelected(model.id), [model.id]);

  // Loads GGUF files the user dropped or picked
  const take = (files: FileList | null) => {
    setProblem("");
    if (files?.length && !busy && status !== "loading") adopt([...files]).catch((error: Error) => setProblem(error.message));
  };

  return (
    <FieldGroup className="gap-4">
      <Field orientation="horizontal">
        <FieldLabel>Chat model</FieldLabel>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Pick label="Chat model" items={items.map((item) => ({ value: item.id, label: `${item.name} · ${item.size}${saved.includes(item.id) ? " · downloaded" : ""}` }))} value={chosen.id} disabled={busy || status === "loading"} onChange={(value) => { setSelected(value); setProblem(""); }}>
            <span className="max-w-56 truncate">{chosen.name}</span>
          </Pick>
          {(!current || status === "idle" || status === "error") && (
            <Button size="sm" disabled={busy || status === "loading"} onClick={() => { setProblem(""); void (current ? preload() : pick(chosen.id)).catch((error: Error) => setProblem(error.message)); }}>
              {current && status === "error" ? "Retry" : have ? "Use" : "Download"}
            </Button>
          )}
          {current && status === "loading" && <span className="text-sm text-muted-foreground tabular-nums">{Math.round(progress * 100)}%</span>}
          {!current && have && (
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${chosen.name}`} disabled={busy || status === "loading"} onClick={() => void remove(chosen.id).then(() => { setSelected(model.id); refresh(); }).catch((error: Error) => setProblem(error.message))}>
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          )}
        </div>
      </Field>
      <Field orientation="horizontal">
        <FieldLabel>Embedding model</FieldLabel>
        <span className="text-sm text-muted-foreground">{embedding.name} · {embedder.status === "loading" ? `${Math.round(embedder.progress * 100)}%` : embedder.status === "idle" ? embedding.size : embedder.status}</span>
      </Field>
      <Voice />
      <label
        className="cursor-pointer rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground hover:border-primary"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          take(event.dataTransfer.files);
        }}
      >
        Drop a chat model .gguf here, with its mmproj for vision, or click to choose
        <input type="file" accept=".gguf" multiple hidden onChange={(event) => { take(event.target.files); event.target.value = ""; }} />
      </label>
      <div className="grid gap-x-6 gap-y-4 border-t pt-3 sm:grid-cols-2">
        <p className="font-medium sm:col-span-2">Sampling</p>
        {sliders.map((item) => (
          <Field key={item.key}>
            <div className="flex items-center justify-between">
              <FieldLabel>{item.label}</FieldLabel>
              <span className="font-mono text-sm text-muted-foreground">{opts[item.key]}</span>
            </div>
            <Slider aria-label={item.label} disabled={busy} min={item.min} max={item.max} step={item.step} value={opts[item.key]} onValueChange={(value) => change({ [item.key]: value as number })} />
          </Field>
        ))}
        <Button variant="outline" size="sm" className="self-start" disabled={busy} onClick={() => change(model.preset)}>
          Reset sampling
        </Button>
      </div>
      {(problem || (current && status === "error" && error)) && <p role="alert" className="text-sm break-words text-destructive">{problem || error}</p>}
    </FieldGroup>
  );
}

// Context size and device speed check, shown in General.
export function Performance() {
  const { model, status, busy } = useModel();
  const [opts, change] = useOptions(model.id);
  const [problem, setProblem] = useState("");
  const [score, setScore] = useState<Awaited<ReturnType<typeof measure>> | null>(null);
  const [checking, setChecking] = useState(false);
  const check = useRef<AbortController | null>(null);
  useEffect(() => setScore(null), [model.id]);
  useEffect(() => () => { check.current?.abort(); check.current = null; }, []);

  // Cancels or measures a short, isolated reply with the current model.
  async function test() {
    if (check.current) return check.current.abort();
    const request = new AbortController();
    check.current = request;
    setChecking(true);
    setProblem("");
    setScore(null);
    try {
      const result = await measure(request.signal);
      if (check.current === request) setScore(result);
    } catch (error) {
      if (!request.signal.aborted && check.current === request) setProblem(error instanceof Error ? error.message : "Check failed. Try again.");
    } finally {
      if (check.current === request) { check.current = null; setChecking(false); }
    }
  }

  return (
    <>
      <Field orientation="horizontal">
        <FieldLabel>Context size</FieldLabel>
        <Pick label="Context size" items={contexts} value={opts.n_ctx} disabled={busy} restart={opts.n_ctx !== loaded} onChange={(n_ctx) => change({ n_ctx })} />
      </Field>
      <Field orientation="horizontal">
        <FieldLabel>Device performance</FieldLabel>
        <span role="status" className="ml-auto text-sm text-muted-foreground tabular-nums">{checking ? "Checking…" : score ? `${score.speed.toFixed(1)} tok/s · ${score.backend}` : status !== "ready" ? "Load a model first." : navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cores` : ""}</span>
        <Button variant="outline" size="sm" disabled={!checking && (busy || status !== "ready")} onClick={() => void test()}>{checking ? "Cancel" : "Run check"}</Button>
      </Field>
      {problem && <p role="alert" className="text-sm break-words text-destructive">{problem}</p>}
    </>
  );
}
