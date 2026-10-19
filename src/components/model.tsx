import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { Pick } from "@/components/pick";
import { Voice } from "@/components/voice";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { embedding, useEmbedder } from "@/lib/embed";
import { adopt, cached, measure, pick, preload, remove, useModel } from "@/lib/llm";
import { models, options, own, useOptions } from "@/lib/models";

// Sampling controls shown as sliders
const sliders = [
  { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.05 },
  { key: "top_k", label: "Top K", min: 0, max: 100, step: 1 },
  { key: "top_p", label: "Top P", min: 0, max: 1, step: 0.05 },
  { key: "min_p", label: "Min P", min: 0, max: 1, step: 0.01 },
  { key: "repeat_penalty", label: "Repeat penalty", min: 1, max: 2, step: 0.01 },
  { key: "presence_penalty", label: "Presence penalty", min: 0, max: 2, step: 0.1 },
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
  const file = useRef<HTMLInputElement>(null);
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
    <FieldGroup>
      <Field orientation="horizontal" className="flex-col items-stretch sm:flex-row sm:items-center">
        <FieldLabel>Chat model</FieldLabel>
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
          <Pick label="Chat model" items={items.map((item) => ({ value: item.id, label: `${item.name} · ${item.size}${saved.includes(item.id) ? " · downloaded" : ""}` }))} value={chosen.id} disabled={busy || status === "loading"} onChange={(value) => { setSelected(value); setProblem(""); }}>
            <span className="max-w-48 truncate">{chosen.name}</span>
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
      <Field orientation="horizontal" className="flex-wrap">
        <FieldLabel>Embedding model</FieldLabel>
        <span className="text-sm text-muted-foreground">{embedding.name} · {embedder.status === "loading" ? `${Math.round(embedder.progress * 100)}%` : embedder.status === "idle" ? embedding.size : embedder.status}</span>
      </Field>
      <div
        className="grid gap-2"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          take(event.dataTransfer.files);
        }}
      >
        <Button variant="outline" className="h-auto min-h-11 border-dashed py-3" disabled={busy || status === "loading"} onClick={() => file.current?.click()}>Add a GGUF model</Button>
        <FieldDescription>Choose or drop a .gguf file. Include its mmproj file for vision.</FieldDescription>
        <input ref={file} type="file" accept=".gguf" multiple hidden onChange={(event) => { take(event.target.files); event.target.value = ""; }} />
      </div>
      <details className="group/voice">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md text-sm font-medium [&::-webkit-details-marker]:hidden">
          Voice & dictation
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="shrink-0 text-muted-foreground group-open/voice:rotate-180" />
        </summary>
        <FieldGroup className="pt-3"><Voice /></FieldGroup>
      </details>
      <details className="group/sampling">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-md text-sm font-medium [&::-webkit-details-marker]:hidden">
          Advanced sampling
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} className="shrink-0 text-muted-foreground group-open/sampling:rotate-180" />
        </summary>
        <div className="grid gap-x-6 gap-y-5 pt-4 sm:grid-cols-2">
        {sliders.map((item) => (
          <Field key={item.key}>
            <div className="flex items-center justify-between">
              <FieldLabel>{item.label}</FieldLabel>
              <span className="text-sm text-muted-foreground tabular-nums">{opts[item.key]}</span>
            </div>
            <Slider aria-label={item.label} disabled={busy} min={item.min} max={item.max} step={item.step} value={opts[item.key]} onValueChange={(value) => change({ [item.key]: value as number })} />
          </Field>
        ))}
        <Button variant="outline" size="sm" className="self-start" disabled={busy} onClick={() => change(opts.think && model.reasoning ? model.reasoning : model.preset)}>
          Reset sampling
        </Button>
        </div>
      </details>
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
        <div className="min-w-0 flex-1">
          <FieldLabel>Device performance</FieldLabel>
          <p role="status" className="mt-1 text-xs text-muted-foreground tabular-nums">{checking ? "Checking…" : score ? `${score.speed.toFixed(1)} tok/s · ${score.backend}` : status !== "ready" ? "Load a model first." : navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} cores` : ""}</p>
        </div>
        <Button variant="outline" size="sm" disabled={!checking && (busy || status !== "ready")} onClick={() => void test()}>{checking ? "Cancel" : "Run check"}</Button>
      </Field>
      {problem && <p role="alert" className="text-sm break-words text-destructive">{problem}</p>}
    </>
  );
}
