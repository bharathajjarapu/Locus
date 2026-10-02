import { Pick } from "@/components/pick";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useModel } from "@/lib/llm";
import { rule, setRule, useRules } from "@/lib/rules";
import { tools } from "@/lib/tools";

const choices = [
  { value: "ask", label: "Ask" },
  { value: "allow", label: "Always allow" },
  { value: "deny", label: "Deny" },
] as const;

// How each tool is handled when the model wants to use it
export function Tools() {
  const { model } = useModel();
  useRules();
  return (
    <FieldGroup>
      {!model.tools && <FieldDescription>{model.name} can't call tools. Switch to a model that can.</FieldDescription>}
      {tools.map((tool) => (
        <Field key={tool.name} orientation="horizontal">
          <FieldContent>
            <FieldLabel>{tool.label}</FieldLabel>
            <FieldDescription>{tool.description}</FieldDescription>
          </FieldContent>
          <Pick label={tool.label} items={choices} value={rule(tool.name)} onChange={(value) => setRule(tool.name, value)} />
        </Field>
      ))}
    </FieldGroup>
  );
}
