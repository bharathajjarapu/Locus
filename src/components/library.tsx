import { useRef, useState, type ChangeEvent } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { read } from "@/lib/docs";
import { edit, forget, useMemory } from "@/lib/memory";
import { add, remove, useLibrary } from "@/lib/rag";

// Indexed files and saved memories the model can search
export function Library() {
  const { entries, indexing } = useLibrary();
  const { memories } = useMemory();
  const [problem, setProblem] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
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

  // Saves an edited memory unless it was emptied or unchanged
  function save(id: string, text: string) {
    setEditing(null);
    if (text.trim() && text.trim() !== memories.find((memory) => memory.id === id)?.text) edit(id, text.trim()).catch((error) => setProblem(String(error)));
  }

  return (
    <FieldGroup>
      <section>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>Indexed files</FieldLabel>
          <Button variant="outline" size="sm" disabled={!!indexing} onClick={() => input.current?.click()}>
            {indexing ? "Indexing…" : "Add files"}
          </Button>
          <input ref={input} type="file" multiple hidden onChange={upload} />
        </div>
        {indexing && <p role="status" className="mt-2 break-words text-xs text-muted-foreground">Indexing {indexing}…</p>}
        <div className="mt-2 divide-y">
          {!entries.length && <p className="py-5 text-sm text-muted-foreground">Add documents for Locus to search in your chats.</p>}
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{entry.name}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {Math.max(1, Math.round(entry.size / 1000))}k characters · {entry.chunks} passages
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`Delete ${entry.name}`} onClick={() => void remove(entry.id)}>
                <HugeiconsIcon icon={Delete02Icon} />
              </Button>
            </div>
          ))}
        </div>
      </section>
      {memories.length > 0 && <section>
        <FieldLabel>Memories</FieldLabel>
        <div className="mt-2 divide-y">
          {memories.toSorted((a, b) => b.at - a.at).map((memory) => (
            <div key={memory.id} className="flex items-center gap-2 py-3">
              {editing === memory.id ? (
                <Input
                  autoFocus
                  defaultValue={memory.text}
                  aria-label="Memory"
                  onBlur={(event) => save(memory.id, event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") save(memory.id, event.currentTarget.value);
                    if (event.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <>
                  <div className="min-w-0 flex-1 break-words text-sm">{memory.text}</div>
                  <Button variant="ghost" size="icon-sm" aria-label="Edit memory" onClick={() => setEditing(memory.id)}>
                    <HugeiconsIcon icon={PencilEdit01Icon} />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon-sm" aria-label="Delete memory" onClick={() => void forget(memory.id)}>
                <HugeiconsIcon icon={Delete02Icon} />
              </Button>
            </div>
          ))}
        </div>
      </section>}
      {problem && (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
    </FieldGroup>
  );
}
