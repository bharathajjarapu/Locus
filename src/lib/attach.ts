import { useState } from "react";
import { read } from "@/lib/docs";
import { canSee } from "@/lib/llm";
import { add } from "@/lib/rag";
import { uid, type Attached } from "@/lib/store";

export type Attachment = { id: string; name: string; status: "reading" | "indexing" | "ready" | "failed"; text?: string; image?: Blob; error?: string };

// Longest text that goes straight into the prompt; longer files are saved to the library for the model to search
const inline = 4000;

// Files waiting in the message bar, read in the background as soon as they are added
export function useAttachments() {
  const [files, setFiles] = useState<Attachment[]>([]);
  const patch = (id: string, change: Partial<Attachment>) => setFiles((list) => list.map((file) => (file.id === id ? { ...file, ...change } : file)));

  // Reads each file in turn and sorts it into the prompt or the library
  async function attach(picked: File[]) {
    const items = picked.map((file): Attachment => ({ id: uid(), name: file.name, status: "reading" }));
    setFiles((list) => [...list, ...items]);
    for (const [index, file] of picked.entries()) {
      const { id } = items[index];
      // A model that sees pictures gets them as they are; others read them through the vision reader
      if (file.type.startsWith("image/") && canSee()) {
        patch(id, { status: "ready", image: file });
        continue;
      }
      try {
        const text = (await read(file)).trim();
        if (!text) throw new Error("No readable text");
        if (text.length <= inline) patch(id, { status: "ready", text });
        else {
          patch(id, { status: "indexing" });
          await add(file.name, text);
          patch(id, { status: "ready" });
        }
      } catch (error) {
        patch(id, { status: "failed", error: (error as Error).message });
      }
    }
  }

  return {
    files,
    attach,
    detach: (id: string) => setFiles((list) => list.filter((file) => file.id !== id)),
    clear: () => setFiles([]),
    // Whether any file is still being read
    busy: files.some((file) => file.status === "reading" || file.status === "indexing"),
    // The files that can be sent with the message
    ready: (): Attached[] => files.filter((file) => file.status === "ready").map(({ name, text, image }) => ({ name, text, ...(image && { image: true }) })),
    // The pictures to show the model with the next message
    images: () => files.flatMap((file) => (file.image ? [file.image] : [])),
  };
}
