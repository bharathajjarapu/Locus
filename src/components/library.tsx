import { useRef, useState, type ChangeEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLabel } from "@/components/ui/field";
import { read } from "@/lib/docs";
import { forget, useMemory } from "@/lib/memory";
import { add, remove, useLibrary } from "@/lib/rag";

// Indexed files and saved memories the model can search
export function Library() {
  const { entries, indexing } = useLibrary();
  const { memories } = useMemory();
  const [problem, setProblem] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // Indexes each chosen file in turn
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    setProblem("");
    try {
      for (const file of files) {
        const content = await read(file);
        await add(file.name, content.text, content.pages ? { file, pages: content.pages } : undefined);
      }
    } catch (error) {
      setProblem(String(error));
    }
  }

  return (
    <FieldGroup>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FieldLabel>Indexed files</FieldLabel>
        <Button variant="outline" size="sm" disabled={!!indexing} onClick={() => input.current?.click()}>
          {indexing ? `Indexing ${indexing}…` : "Add files"}
        </Button>
      </div>
      <div className="grid gap-2">
        {!entries.length && <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">No files yet</p>}
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
      {memories.length > 0 && <FieldLabel>Memories</FieldLabel>}
      <div className="grid gap-2">
        {memories.toSorted((a, b) => b.at - a.at).map((memory) => (
          <div key={memory.id} className="flex items-center gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1 text-sm">{memory.text}</div>
            <Button variant="ghost" size="icon-sm" aria-label="Delete memory" onClick={() => void forget(memory.id)}>
              <HugeiconsIcon icon={Delete02Icon} />
            </Button>
          </div>
        ))}
      </div>
      <input ref={input} type="file" multiple hidden onChange={upload} />
      {problem && (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
    </FieldGroup>
  );
}
