import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { answer, usePermit } from "@/lib/agent";

// Asks whether the model may run a tool, until the user decides
export function Permit() {
  const { question } = usePermit();
  if (!question) return null;
  return (
    <Alert className="mb-2">
      <AlertDescription>
        <span className="font-medium text-foreground">{question.tool.label}</span> wants to run <code className="break-all">{question.args}</code>
      </AlertDescription>
      <div className="mt-2 flex gap-2">
        <Button size="xs" onClick={() => answer("allow")}>
          Allow
        </Button>
        <Button size="xs" variant="outline" onClick={() => answer("always")}>
          Always allow
        </Button>
        <Button size="xs" variant="ghost" onClick={() => answer("deny")}>
          Deny
        </Button>
      </div>
    </Alert>
  );
}
