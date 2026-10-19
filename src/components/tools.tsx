import { Pick } from "@/components/pick";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useModel } from "@/lib/llm";
import { rule, setRule, useRules } from "@/lib/rules";
import { useSaved } from "@/lib/saved";
import { tools } from "@/lib/tools";
import { keyName } from "@/lib/web";

const choices = [
  { value: "ask", label: "Ask" },
  { value: "allow", label: "Always allow" },
  { value: "deny", label: "Deny" },
] as const;

// How each tool is handled when the model wants to use it, plus the web search key
export function Tools() {
  const { model } = useModel();
  const [key, setKey] = useSaved<string>(keyName, "");
  useRules();
  return (
    <FieldGroup>
      {!model.tools && <FieldDescription>{model.name} can't call tools. Switch to a model that can.</FieldDescription>}
      {tools.map((tool) => (
        <Field key={tool.name} orientation="horizontal">
          <FieldLabel>{tool.label}</FieldLabel>
          <Pick label={tool.label} items={choices} value={rule(tool.name)} onChange={(value) => setRule(tool.name, value)} />
        </Field>
      ))}
      <Field>
        <FieldLabel htmlFor="tinyfish">TinyFish API key</FieldLabel>
        <Input id="tinyfish" type="password" value={key} placeholder="Optional" autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={(event) => setKey(event.target.value)} />
        <FieldDescription className="text-xs">For web search and page reading. Get a key at <a href="https://agent.tinyfish.ai" target="_blank" rel="noreferrer">agent.tinyfish.ai</a>.</FieldDescription>
      </Field>
    </FieldGroup>
  );
}
