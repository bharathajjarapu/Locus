import { Pick } from "@/components/pick";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { lengths, personaKey, tones } from "@/lib/prompt";
import { useSaved } from "@/lib/saved";

const presets = [
  { value: "Keep answers short and direct.", label: "Concise" },
  { value: "Act as a patient tutor. Explain step by step and check understanding.", label: "Tutor" },
  { value: "Act as a senior software engineer. Prefer clear code and brief explanations.", label: "Coder" },
  { value: "Act as a skilled editor. Write clearly, vary sentence length and avoid clichés.", label: "Writer" },
  { value: "Explain like I'm new to the topic. Use plain words and everyday analogies.", label: "Simple" },
];

// About the user, answer style and extra instructions added to every chat's system prompt
export function Persona() {
  const [persona, setPersona] = useSaved<string>(personaKey, "");
  const [about, setAbout] = useSaved<string>("about", "");
  const [tone, setTone] = useSaved<string>("tone", "neutral");
  const [length, setLength] = useSaved<string>("length", "balanced");
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="about">About you</FieldLabel>
        <Input id="about" value={about} placeholder="Nursing student in Hyderabad, likes cricket" onChange={(event) => setAbout(event.target.value)} />
      </Field>
      <Field orientation="horizontal">
        <FieldLabel>Tone</FieldLabel>
        <Pick label="Tone" items={tones} value={tone} onChange={setTone} />
      </Field>
      <Field orientation="horizontal">
        <FieldLabel>Length</FieldLabel>
        <Pick label="Length" items={lengths} value={length} onChange={setLength} />
      </Field>
      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="persona">Instructions</FieldLabel>
          <Pick label="Presets" items={presets} value={persona} onChange={setPersona}>Presets</Pick>
        </div>
        <Textarea id="persona" rows={3} value={persona} placeholder="You are a patient math tutor." onChange={(event) => setPersona(event.target.value)} />
      </Field>
    </FieldGroup>
  );
}
