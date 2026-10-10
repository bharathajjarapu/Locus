import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { skills, skillsKey, type Skill } from "@/lib/prompt";
import { useSaved } from "@/lib/saved";

// Prompt templates the user adds, edits and deletes; /name in a message uses one
export function Skills() {
  const [raw, setRaw] = useSaved<string>(skillsKey, JSON.stringify(skills()));
  const list: Skill[] = JSON.parse(raw);
  const save = (next: Skill[]) => setRaw(JSON.stringify(next));
  const change = (index: number, patch: Partial<Skill>) => save(list.map((item, at) => (at === index ? { ...item, ...patch } : item)));
  return (
    <FieldGroup>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel>Templates</FieldLabel>
        <Button variant="outline" size="sm" onClick={() => save([...list, { name: "", text: "" }])}>Add</Button>
      </div>
      <FieldDescription>Start a message with /name to use one.</FieldDescription>
      {list.map((skill, index) => (
        <div key={index} className="grid gap-2 rounded-lg border p-3">
          <div className="flex gap-2">
            <Input value={skill.name} placeholder="name" aria-label="Template name" onChange={(event) => change(index, { name: event.target.value.replace(/\s/g, "") })} />
            <Button variant="ghost" size="icon-sm" aria-label="Delete template" onClick={() => save(list.filter((_, at) => at !== index))}>
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          </div>
          <Textarea rows={2} value={skill.text} placeholder="Instructions for the model" aria-label="Template prompt" onChange={(event) => change(index, { text: event.target.value })} />
        </div>
      ))}
    </FieldGroup>
  );
}
