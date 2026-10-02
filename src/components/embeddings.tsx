import { useRef, useState, type ChangeEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { read } from "@/lib/docs";
import { embedding, useEmbedder } from "@/lib/embed";
import { add, remove, useLibrary } from "@/lib/rag";

// Embedding model status and the documents the model can search
export function Embeddings() {
  const { status, progress } = useEmbedder();
  const { entries, indexing } = useLibrary();
  const [problem, setProblem] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // Indexes each chosen file in turn
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setProblem("");
    try {
      for (const file of files) await add(file.name, await read(file));
    } catch (error) {
      setProblem(String(error));
    }
  }

  return (
    <FieldGroup>
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{embedding.name}</div>
          <div className="text-sm text-muted-foreground">Finds passages by meaning · {embedding.size}</div>
        </div>
        <span className="text-sm text-muted-foreground">{status === "loading" ? `${Math.round(progress * 100)}%` : status === "idle" ? "Loads on first use" : status}</span>
      </div>
      <div className="grid gap-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-center gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{entry.name}</div>
              <div className="text-sm text-muted-foreground">
                {Math.max(1, Math.round(entry.size / 1000))}k characters · {entry.chunks} passages
              </div>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${entry.name}`} onClick={() => void remove(entry.id)}>
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" className="self-start" disabled={!!indexing} onClick={() => input.current?.click()}>
        {indexing ? `Indexing ${indexing}…` : "Add files"}
      </Button>
      <input ref={input} type="file" multiple hidden onChange={upload} />
      {problem && (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
    </FieldGroup>
  );
}
