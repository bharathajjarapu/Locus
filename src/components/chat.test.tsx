// With bun dev running: agent-browser eval "import('/src/components/chat.test.tsx').then(module => module.check())"
import { createRoot } from "react-dom/client";
import { Chat } from "./chat";
import { SidebarProvider } from "./ui/sidebar";
import { getMessages, removeChat, saveMessages, type Message } from "@/lib/store";

// Checks bounded initial history, earlier batches, scroll anchoring and fork indices.
export async function check() {
  const id = crypto.randomUUID();
  const messages: Message[] = Array.from({ length: 120 }, (_, index) => ({ id: String(index), role: index % 2 ? "assistant" : "user", content: `Message ${index}\n\n` + "Saved content. ".repeat(20) }));
  saveMessages(id, messages);
  const save = Storage.prototype.setItem;
  let writes = 0;
  Storage.prototype.setItem = function (key, value) { if (key === `chat_${id}`) writes++; return save.call(this, key, value); };
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:100;background:var(--background);display:flex";
  document.body.append(host);
  const root = createRoot(host);
  const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
  // Waits for React, Markdown and browser layout to settle.
  const wait = async (ready: () => boolean) => {
    for (let tries = 0; tries < 200; tries++) {
      if (ready()) { await new Promise((resolve) => setTimeout(resolve, 50)); return; }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Chat did not settle: ${JSON.stringify(Array.from(host.querySelectorAll<HTMLElement>(".overflow-y-auto"), (pane) => ({ top: pane.scrollTop, height: pane.scrollHeight, client: pane.clientHeight })))}`);
  };
  let fork: Message[] = [];
  try {
    root.render(<SidebarProvider defaultOpen={false}><Chat chat={{ id, name: "History" }} name="" nerd={false} onTitle={() => {}} onFork={(messages) => fork = messages} onNew={() => {}} /></SidebarProvider>);
    await wait(() => !!host.querySelector('[data-slot="message"]:last-child .prose'));
    assert(host.querySelectorAll('[data-slot="message"]').length === 40, "Opening a chat rendered the entire history");
    assert(host.querySelector('[data-slot="message"]')?.textContent?.includes("Message 80"), "Wrong initial history window");
    const pane = host.querySelector<HTMLElement>(".overflow-y-auto.fade")!;
    await wait(() => pane.scrollHeight - pane.scrollTop - pane.clientHeight < 5);
    const row = host.querySelector<HTMLElement>('[data-slot="message"]')!;
    pane.scrollTop = 100;
    const top = row.getBoundingClientRect().top;
    pane.dispatchEvent(new Event("scroll", { bubbles: true }));
    await wait(() => host.querySelectorAll('[data-slot="message"]').length === 60);
    assert(Math.abs(row.getBoundingClientRect().top - top) < 3, `Loading earlier messages moved the visible passage: ${row.getBoundingClientRect().top - top}px`);
    host.querySelector<HTMLButtonElement>('[data-slot="message"] button[aria-label="Fork"]')!.click();
    assert(fork.length === 62 && fork.at(-1)?.id === "61", "Fork used the visible index instead of the full history index");
    const earlier = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Load earlier"));
    assert(earlier, "Earlier history was inaccessible to keyboard users");
    for (const count of [80, 100, 120]) {
      earlier!.click();
      await wait(() => host.querySelectorAll('[data-slot="message"]').length === count);
    }
    assert(host.querySelector('[data-slot="message"]')?.textContent?.includes("Message 0"), "Oldest message was lost");
    assert(getMessages(id).length === 120, "Paging rewrote or truncated saved history");
    assert(writes === 0, "Opening or paging a chat rewrote unchanged history");
    // A local failure finishes the send path without downloading a model.
    localStorage.setItem(`chat_meta_${id}`, "{");
    const input = host.querySelector<HTMLTextAreaElement>('textarea[placeholder="Message…"]')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "Save this message");
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await wait(() => !!host.querySelector('button[aria-label="Send"]'));
    host.querySelector<HTMLButtonElement>('button[aria-label="Send"]')!.click();
    await wait(() => getMessages(id).length === 122);
    assert(getMessages(id).at(-2)?.content === "Save this message" && writes === 1, "Completing a send lost history or saved it twice");
    return "Chat history checks passed";
  } finally { root.unmount(); host.remove(); Storage.prototype.setItem = save; removeChat(id); }
}
