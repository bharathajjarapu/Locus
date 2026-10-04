import { useRef, useState, type ChangeEvent } from "react";
import { Pick } from "@/components/pick";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
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

// Profile, speed readout, compute and backup settings
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
      <Field orientation="horizontal">
        <FieldLabel>Compute</FieldLabel>
        <Pick label="Compute" items={computes} value={opts.compute} restart={opts.compute !== loaded} onChange={(compute) => change({ compute })} />
      </Field>
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel>Backup</FieldLabel>
          <FieldDescription>Export chats or restore them from a backup file.</FieldDescription>
        </FieldContent>
        <Button variant="outline" size="sm" onClick={() => download(`locus-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(exportAll(chats), null, 2), "application/json")}>
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
    </FieldGroup>
  );
}
