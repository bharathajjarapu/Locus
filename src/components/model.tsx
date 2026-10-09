import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Pick } from "@/components/pick";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
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

// Compact model picker, device speed check and expandable sampling settings.
export function Model() {
  const { model, status, progress, busy, error } = useModel();
  const [opts, change] = useOptions(model.id);
  const [saved, setSaved] = useState<string[]>([]);
  const [problem, setProblem] = useState("");
  const [selected, setSelected] = useState(model.id);
  const [score, setScore] = useState<Awaited<ReturnType<typeof measure>> | null>(null);
  const [checking, setChecking] = useState(false);
  const check = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const items = models.concat(own() ?? []);
  const chosen = items.find((item) => item.id === selected) ?? model;
  const current = chosen.id === model.id;
  const have = saved.includes(chosen.id);

  // Refreshes which models are downloaded
  const refresh = () => void cached().then(setSaved).catch((error: Error) => setProblem(error.message));
  useEffect(refresh, [status, model.id]);
  useEffect(() => { setSelected(model.id); setScore(null); }, [model.id]);
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

  // Loads GGUF files the user dropped or picked
  const take = (files: FileList | null) => {
    setProblem("");
    if (files?.length && !busy && status !== "loading") adopt([...files]).catch((error: Error) => setProblem(error.message));
  };

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel>Chat model</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <Pick label="Chat model" items={items.map((item) => ({ value: item.id, label: `${item.name} · ${item.size}${saved.includes(item.id) ? " · downloaded" : ""}` }))} value={chosen.id} disabled={busy || status === "loading"} onChange={(value) => { setSelected(value); setScore(null); setProblem(""); }}>
            <span className="max-w-56 truncate">{chosen.name}</span>
          </Pick>
          {(!current || status === "idle" || status === "error") && (
            <Button size="sm" disabled={busy || status === "loading"} onClick={() => { setProblem(""); void (current ? preload() : pick(chosen.id)).catch((error: Error) => setProblem(error.message)); }}>
              {current && status === "error" ? "Retry" : have ? "Use" : "Download"}
            </Button>
          )}
          {!current && have && (
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${chosen.name}`} disabled={busy || status === "loading"} onClick={() => void remove(chosen.id).then(() => { setSelected(model.id); refresh(); }).catch((error: Error) => setProblem(error.message))}>
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          )}
        </div>
        <FieldDescription>{chosen.note} · {chosen.size} · {current && status === "loading" ? `Downloading ${Math.round(progress * 100)}%` : current && status === "ready" ? backend() : have ? "Downloaded" : "Not downloaded"}</FieldDescription>
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-t pt-2"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            take(event.dataTransfer.files);
          }}
        >
          <span className="text-sm text-muted-foreground">Drop GGUF and optional mmproj files</span>
          <Button variant="outline" size="sm" disabled={busy || status === "loading"} onClick={() => input.current?.click()}>Import GGUF</Button>
          <input ref={input} type="file" accept=".gguf" multiple hidden onChange={(event) => { take(event.target.files); event.target.value = ""; }} />
        </div>
      </Field>
      <Field orientation="horizontal">
        <FieldLabel>Context size</FieldLabel>
        <Pick label="Context size" items={contexts} value={opts.n_ctx} disabled={busy} restart={opts.n_ctx !== loaded} onChange={(n_ctx) => change({ n_ctx })} />
      </Field>
      <Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel>Device performance</FieldLabel>
          <Button variant="outline" size="sm" disabled={!checking && (busy || status !== "ready" || !current)} onClick={() => void test()}>{checking ? "Cancel check" : "Run check"}</Button>
        </div>
        <FieldDescription>{navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} logical CPU cores. ` : ""}A short check using the loaded model.</FieldDescription>
        <p role="status" className="text-sm tabular-nums">{checking ? "Checking model speed…" : score ? `${score.speed.toFixed(1)} tokens/s · ${score.tokens} tokens · ${score.backend}` : status !== "ready" || !current ? "Load the selected model to run the check." : "Ready to measure. Your chat stays unchanged."}</p>
      </Field>
      <details className="border-t">
        <summary className="cursor-pointer py-3 font-medium">Sampling</summary>
        <div className="grid gap-x-6 gap-y-4 pt-1 sm:grid-cols-2">
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
      </details>
      {(problem || (current && status === "error" && error)) && <p role="alert" className="text-sm break-words text-destructive">{problem || error}</p>}
    </FieldGroup>
  );
}
