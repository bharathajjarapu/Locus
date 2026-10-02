import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { personaKey } from "@/lib/prompt";
import { useSaved } from "@/lib/saved";

const presets = [
  { label: "Concise", text: "Keep answers short and direct." },
  { label: "Tutor", text: "Act as a patient tutor. Explain step by step and check understanding." },
  { label: "Coder", text: "Act as a senior software engineer. Prefer clear code and brief explanations." },
];

// Extra instructions added to every chat's system prompt
export function Persona() {
  const [persona, setPersona] = useSaved<string>(personaKey, "");
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="persona">Persona</FieldLabel>
        <Textarea id="persona" rows={5} value={persona} placeholder="You are a patient math tutor." onChange={(event) => setPersona(event.target.value)} />
        <FieldDescription>Added to the system prompt of every chat.</FieldDescription>
      </Field>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button key={preset.label} variant="outline" size="sm" onClick={() => setPersona(preset.text)}>
            {preset.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setPersona("")}>
          Clear
        </Button>
      </div>
    </FieldGroup>
  );
}
