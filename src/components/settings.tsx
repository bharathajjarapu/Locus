import { useRef, useState, type ChangeEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { backend, clear, defaults, model, options, setOptions, useModel, type Options } from "@/lib/llm";
import { exportAll, importAll, type Chat } from "@/lib/store";

// Sampling controls shown as sliders
const sliders = [
  { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.05, hint: "Higher is more creative, lower is more focused." },
  { key: "top_k", label: "Top K", min: 0, max: 100, step: 1, hint: "Pick from the K likeliest tokens. 0 turns it off." },
  { key: "top_p", label: "Top P", min: 0, max: 1, step: 0.05, hint: "Pick from tokens covering this much probability." },
  { key: "min_p", label: "Min P", min: 0, max: 1, step: 0.01, hint: "Drop tokens far less likely than the top one." },
  { key: "repeat_penalty", label: "Repeat penalty", min: 1, max: 2, step: 0.01, hint: "Discourages repeating the same words." },
  { key: "max_tokens", label: "Max reply length", min: 128, max: 8192, step: 128, hint: "Longest reply in tokens." },
] as const;

const contexts = [2048, 4096, 8192, 16384, 32768].map((value) => ({ value, label: `${value / 1024}K tokens` }));

const computes = [{ value: false, label: "GPU" }, { value: true, label: "CPU" }];

// Context size and compute the model was loaded with this page session
const loaded = options();

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  name: string;
  setName: (name: string) => void;
  nerd: boolean;
  setNerd: (nerd: boolean) => void;
  chats: Chat[];
  setChats: (chats: Chat[]) => void;
};

export function Settings({ open, setOpen, name, setName, nerd, setNerd, chats, setChats }: Props) {
  const { status } = useModel();
  const [problem, setProblem] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const [opts, setOpts] = useState(options);

  // Saves a model option change
  function change(patch: Partial<Options>) {
    const next = { ...opts, ...patch };
    setOpts(next);
    setOptions(next);
  }

  // Downloads every chat as a JSON file
  function download() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([JSON.stringify(exportAll(chats), null, 2)], { type: "application/json" }));
    link.download = `locus-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Restores chats from a chosen backup file
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    try {
      setChats(importAll(JSON.parse(await picked.text())));
      setProblem("");
    } catch {
      setProblem("Invalid backup file.");
    }
  }

  // Wipes cached weights and returns to onboarding
  async function reset() {
    await clear();
    localStorage.removeItem("onboardingComplete");
    location.reload();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[35rem] max-h-[90dvh] flex-col overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Preferences are saved on this device.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="general">
          <TabsList className="w-full">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="pt-2">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Display name</FieldLabel>
                <Input id="name" value={name} placeholder="Your name" onChange={(event) => setName(event.target.value)} />
                <FieldDescription>Used in the greeting and shared with the model.</FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel htmlFor="nerd">Nerd mode</FieldLabel>
                  <FieldDescription>Show speed and token counts on replies.</FieldDescription>
                </FieldContent>
                <Switch id="nerd" checked={nerd} onCheckedChange={setNerd} />
              </Field>
            </FieldGroup>
          </TabsContent>

          <TabsContent value="model" className="pt-2">
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel>{model.name}</FieldLabel>
                  <FieldDescription>
                    {model.size} · Q4 · {status === "ready" ? backend() : status}
                  </FieldDescription>
                </FieldContent>
                {opts.cpu !== loaded.cpu && (
                  <Button variant="outline" size="sm" onClick={() => location.reload()}>
                    Reload
                  </Button>
                )}
                <Select items={computes} value={opts.cpu} onValueChange={(value) => change({ cpu: value ?? false })}>
                  <SelectTrigger aria-label="Compute">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {computes.map((item) => (
                      <SelectItem key={String(item.value)} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => void reset()}>
                  Re-download
                </Button>
              </Field>
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldLabel>Context size</FieldLabel>
                  <FieldDescription>How much of the chat the model remembers. Larger uses more memory.</FieldDescription>
                </FieldContent>
                {opts.n_ctx !== loaded.n_ctx && (
                  <Button variant="outline" size="sm" onClick={() => location.reload()}>
                    Reload
                  </Button>
                )}
                <Select items={contexts} value={opts.n_ctx} onValueChange={(value) => change({ n_ctx: value ?? defaults.n_ctx })}>
                  <SelectTrigger aria-label="Context size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contexts.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {sliders.map((item) => (
                  <Field key={item.key}>
                    <div className="flex items-center justify-between">
                      <FieldLabel>{item.label}</FieldLabel>
                      <span className="font-mono text-sm text-muted-foreground">{opts[item.key]}</span>
                    </div>
                    <Slider
                      aria-label={item.label}
                      min={item.min}
                      max={item.max}
                      step={item.step}
                      value={opts[item.key]}
                      onValueChange={(value) => change({ [item.key]: value as number })}
                    />
                    <FieldDescription>{item.hint}</FieldDescription>
                  </Field>
                ))}
              </div>
              <Button variant="outline" size="sm" className="self-start" onClick={() => change({ ...defaults, n_ctx: opts.n_ctx, cpu: opts.cpu })}>
                Reset sampling
              </Button>
            </FieldGroup>
          </TabsContent>

          <TabsContent value="backup" className="space-y-4 pt-2">
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel>Chats</FieldLabel>
                <FieldDescription>Export chats or restore them from a backup file.</FieldDescription>
              </FieldContent>
              <Button variant="outline" size="sm" onClick={download}>
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => file.current?.click()}>
                Import
              </Button>
              <input ref={file} type="file" accept="application/json" hidden onChange={upload} />
            </Field>
            {problem && (
              <Alert variant="destructive">
                <AlertDescription>{problem}</AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
