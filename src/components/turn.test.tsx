// With bun dev running: agent-browser eval "import('/src/components/turn.test.tsx').then(module => module.check())"
import { createRoot } from "react-dom/client";
import { Turn } from "./turn";
import type { Message } from "@/lib/store";

// Checks formatting, skipped unchanged rows and action indices after paging.
export async function check() {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let reads = 0;
  const calls: string[] = [];
  const message: Message = { id: "turn-check", role: "assistant", get content() { reads++; return "# Saved reply\n\n**Formatted** content and $x^2$."; } };
  const props = { message, index: 81, last: false, busy: false, nerd: false, think: false, onSource: () => {}, onEdit: (text: string, index: number) => { calls.push(`${index}:${text}`); }, onFork: (index: number) => { calls.push(`fork:${index}`); }, onRetry: (index: number) => { calls.push(`retry:${index}`); } };
  // Waits for React and the asynchronous formatter.
  const wait = async (ready: () => boolean) => {
    for (let tries = 0; tries < 200; tries++) {
      if (ready()) { await new Promise((resolve) => setTimeout(resolve, 40)); return; }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error("Reply did not render");
  };
  try {
    root.render(<Turn {...props} />);
    await wait(() => !!host.querySelector(".katex"));
    if (host.querySelector("strong")?.textContent !== "Formatted") throw new Error("Formatting was lost");
    const before = reads;
    root.render(<Turn {...props} />);
    await new Promise((resolve) => setTimeout(resolve, 40));
    if (reads !== before) throw new Error("An unchanged reply rendered again");
    host.querySelector<HTMLButtonElement>('button[aria-label="Fork"]')!.click();
    if (calls.at(-1) !== "fork:81") throw new Error("Fork used the wrong history index");
    host.querySelector<HTMLButtonElement>('button[aria-label="Retry"]')!.click();
    if (calls.at(-1) !== "retry:81") throw new Error("Retry used the wrong history index");
    root.render(<Turn {...props} message={{ id: "edit-check", role: "user", content: "Original" }} index={80} />);
    await wait(() => !!host.querySelector('button[aria-label="Edit"]'));
    host.querySelector<HTMLButtonElement>('button[aria-label="Edit"]')!.click();
    await wait(() => !!host.querySelector("textarea"));
    host.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.click();
    if (calls.at(-1) !== "80:Original") throw new Error("Edit used the wrong history index");
    return "Reply checks passed";
  } finally { root.unmount(); host.remove(); }
}
