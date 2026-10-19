import { useRef, useState, type ChangeEvent } from "react";
import { Performance } from "@/components/model";
import { Pick } from "@/components/pick";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { options, useOptions } from "@/lib/models";
import { exportAll, importAll, type Chat } from "@/lib/store";
import { download } from "@/lib/utils";

const computes = [
  { value: "auto", label: "Auto" },
  { value: "gpu", label: "GPU" },
  { value: "cpu", label: "CPU" },
] as const;

// Compute the model was loaded with this page session
const loaded = options().compute;

type Props = {
  name: string;
  setName: (name: string) => void;
  nerd: boolean;
  setNerd: (nerd: boolean) => void;
  chats: Chat[];
  setChats: (chats: Chat[]) => void;
};

// Profile, speed readout, compute, performance and backup settings
export function General({ name, setName, nerd, setNerd, chats, setChats }: Props) {
  const [opts, change] = useOptions();
  const [problem, setProblem] = useState("");
  const file = useRef<HTMLInputElement>(null);

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

  return (
    <FieldGroup>
      <Field className="sm:flex-row sm:items-center sm:justify-between">
        <FieldLabel htmlFor="name" className="sm:w-auto">Display name</FieldLabel>
        <Input id="name" className="sm:max-w-56" value={name} placeholder="Your name" autoComplete="nickname" onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field orientation="horizontal">
        <div className="flex-1">
          <FieldLabel htmlFor="nerd">Nerd mode</FieldLabel>
          <FieldDescription className="mt-1 text-xs">Show reply speed and token counts.</FieldDescription>
        </div>
        <Switch id="nerd" checked={nerd} onCheckedChange={setNerd} />
      </Field>
      <Field orientation="horizontal">
        <FieldLabel>Compute</FieldLabel>
        <Pick label="Compute" items={computes} value={opts.compute} restart={opts.compute !== loaded} onChange={(compute) => change({ compute })} />
      </Field>
      <Performance />
      <Field className="sm:flex-row sm:items-center sm:justify-between">
        <div className="sm:w-auto">
          <FieldLabel>Chat backup</FieldLabel>
          <FieldDescription className="mt-1 text-xs">Save your chats or restore a backup.</FieldDescription>
        </div>
        <div className="flex gap-2 sm:w-auto">
          <Button variant="outline" size="sm" onClick={() => download(`locus-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportAll(chats), null, 2), "application/json")}>
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => file.current?.click()}>
            Import
          </Button>
        </div>
        <input ref={file} type="file" accept="application/json" hidden onChange={upload} />
      </Field>
      {problem && (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
    </FieldGroup>
  );
}
