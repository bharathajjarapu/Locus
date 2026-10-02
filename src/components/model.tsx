import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Pick } from "@/components/pick";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { backend, cached, pick, remove, useModel } from "@/lib/llm";
import { models, options, useOptions } from "@/lib/models";
import { cn } from "@/lib/utils";

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

// Model list, memory and sampling settings
export function Model() {
  const { model, status, progress, busy } = useModel();
  const [opts, change] = useOptions(model.id);
  const [saved, setSaved] = useState<string[]>([]);

  // Refreshes which models are downloaded
  const refresh = () => void cached().then(setSaved);
  useEffect(refresh, [status, model.id]);

  return (
    <FieldGroup>
      <div className="grid gap-2">
        {models.map((item) => {
          const current = item.id === model.id;
          const have = saved.includes(item.id);
          return (
            <div key={item.id} className={cn("flex items-center gap-3 rounded-lg border p-3", current && "border-primary")}>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-muted-foreground">
                  {item.note} · {item.size}
                </div>
              </div>
              {current ? (
                <span className="text-sm text-muted-foreground">{status === "loading" ? `${Math.round(progress * 100)}%` : status === "ready" ? backend() : status}</span>
              ) : (
                <>
                  {have && (
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${item.name}`} disabled={busy} onClick={() => void remove(item.id).then(refresh)}>
                      <HugeiconsIcon icon={Delete02Icon} />
                    </Button>
                  )}
                  <Button variant="outline" size="sm" disabled={busy || status === "loading"} onClick={() => void pick(item.id)}>
                    {have ? "Use" : "Download"}
                  </Button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <Field orientation="horizontal">
        <FieldLabel>Memory</FieldLabel>
        <Pick label="Context size" items={contexts} value={opts.n_ctx} restart={opts.n_ctx !== loaded} onChange={(n_ctx) => change({ n_ctx })} />
      </Field>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {sliders.map((item) => (
          <Field key={item.key}>
            <div className="flex items-center justify-between">
              <FieldLabel>{item.label}</FieldLabel>
              <span className="font-mono text-sm text-muted-foreground">{opts[item.key]}</span>
            </div>
            <Slider aria-label={item.label} min={item.min} max={item.max} step={item.step} value={opts[item.key]} onValueChange={(value) => change({ [item.key]: value as number })} />
          </Field>
        ))}
        <Button variant="outline" size="sm" className="self-start" onClick={() => change(model.preset)}>
          Reset
        </Button>
      </div>
    </FieldGroup>
  );
}
