import { lazy, startTransition, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Artifact } from "@/components/artifact";
import { Composer } from "@/components/composer";
import { Header } from "@/components/header";
import { Permit } from "@/components/permit";
import { Question } from "@/components/question";
import { Turn } from "@/components/turn";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { run } from "@/lib/agent";
import { useAttachments } from "@/lib/attach";
import { compact, nameChat, pick, thinks, useModel, type Turn as Prompt } from "@/lib/llm";
import { options } from "@/lib/models";
import { recall } from "@/lib/memory";
import { system, withFiles } from "@/lib/prompt";
import { getMessages, greet, markdown, saveMessages, title, trim, uid, type Chat as ChatTab, type Message as Entry, type Source as Citation } from "@/lib/store";
import { useMobile } from "@/lib/mobile";
import { download } from "@/lib/utils";

type Props = {
  chat: ChatTab;
  name: string;
  nerd: boolean;
  onTitle: (name: string) => void;
  onFork: (messages: Entry[]) => void;
  onNew: () => void;
};

const prompts = ["Explain a concept simply", "Draft a follow-up email", "Brainstorm a weekend project", "Compare two options"];
const Source = lazy(() => import("@/components/source"));

export function Chat({ chat, name, nerd, onTitle, onFork, onNew }: Props) {
  const [messages, setMessages] = useState(() => getMessages(chat.id));
  // shortcut: older batches stay mounted; window both ends if fully expanded chats become costly.
  const [start, setStart] = useState(() => Math.max(0, messages.length - 40));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [incognito, setIncognito] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const next = useRef("");
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const position = useRef(0);
  const anchor = useRef<{ node: Element; top: number } | null>(null);
  const { think, model } = useModel();
  const attachments = useAttachments();
  const [source, setSource] = useState<Citation | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const mobile = useMobile();

  // Opens a passage while remembering where keyboard focus should return.
  const open = useCallback((source: Citation) => {
    opener.current = document.activeElement as HTMLElement;
    startTransition(() => setSource({ ...source }));
  }, []);

  // Closes the viewer and restores focus to the citation.
  function close() { setSource(null); requestAnimationFrame(() => opener.current?.focus()); }

  useEffect(() => () => abort.current?.abort(), []);

  // Sends the queued message once the reply is saved
  useEffect(() => {
    const text = next.current;
    if (!busy && text) {
      next.current = "";
      void send(text);
    }
  }, [busy]);

  // Holds a message until the current reply ends
  function queue(text: string) {
    next.current = `${next.current} ${text}`.trim();
    setInput("");
  }

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    if (anchor.current) {
      // Holds the passage in place as off-screen height estimates settle.
      const restore = () => {
        const saved = anchor.current;
        if (saved) element.scrollTop += saved.node.getBoundingClientRect().top - saved.top;
      };
      restore();
      let frame = requestAnimationFrame(() => {
        restore();
        frame = requestAnimationFrame(() => { restore(); anchor.current = null; });
      });
      return () => cancelAnimationFrame(frame);
    } else if (stick.current) element.scrollTop = element.scrollHeight;
  }, [messages, start]);

  useEffect(() => {
    const element = scroller.current!;
    const observer = new ResizeObserver(() => {
      if (stick.current) element.scrollTop = element.scrollHeight;
    });
    observer.observe(element.firstElementChild!);
    return () => observer.disconnect();
  }, [messages.length === 0]);

  // Prepends a small history batch without moving the passage being read.
  function earlier() {
    if (!start || anchor.current) return;
    const node = scroller.current?.querySelector('[data-slot="message"]');
    if (node) anchor.current = { node, top: node.getBoundingClientRect().top };
    stick.current = false;
    setStart((start) => Math.max(0, start - 20));
  }

  // Sends a message, replacing history from `cut` onward, and streams the reply; while busy, stops the reply and sends it next
  async function send(text: string, cut = messages.length) {
    if (!text.trim()) return;
    if (busy) {
      queue(text);
      return abort.current?.abort();
    }
    // Edits keep the files the original message had
    const isNew = cut === messages.length;
    const files = isNew ? attachments.ready() : messages[cut]?.files;
    const images = isNew ? attachments.images() : [];
    const history: Entry[] = [...messages.slice(0, cut), { id: uid(), role: "user", content: text, ...(files?.length && { files }) }];
    const sources = files?.flatMap((file) => file.sources ?? []) ?? [];
    const answer: Entry = { id: uid(), role: "assistant", content: "", ...(sources.length && { sources }) };
    let latest = answer;
    let frame = 0;
    const flush = () => {
      frame = 0;
      setMessages((list) => list.map((message) => (message.id === answer.id ? latest : message)));
    };

    anchor.current = null;
    setMessages([...history, answer]);
    if (cut < messages.length) setStart(Math.max(0, Math.min(start, cut - 40)));
    setInput("");
    attachments.clear();
    setBusy(true);
    stick.current = true;
    position.current = 0;
    if (cut === 0 && chat.name === "Chat" && !incognito) onTitle(title(text, 2));

    const controller = new AbortController();
    abort.current = controller;
    try {
      const full = history.map((message) => ({ ...message, content: withFiles(message) }));
      const budget = options().n_ctx * 2;
      // Incognito chats are not saved, so they only trim
      const { summary, live } = incognito ? { summary: "", live: trim(full, budget) } : await compact(chat.id, full, budget, controller.signal);
      const turns: Prompt[] = live.map(({ role, content }) => ({ role, content }));
      // Pictures go with the newest message only, since they are not saved
      if (images.length)
        turns[turns.length - 1] = {
          role: "user",
          content: [
            ...(await Promise.all(images.map(async (image) => ({ type: "image" as const, data: await image.arrayBuffer() })))),
            { type: "text", text: turns[turns.length - 1].content as string },
          ],
        };
      const update = (patch: Partial<Entry>) => {
        latest = { ...latest, ...patch };
        frame ||= requestAnimationFrame(flush);
      };
      const facts = await recall(text).catch(() => []);
      await run({
        turns: [{ role: "system", content: system(name, facts.map((fact) => fact.text)) + (summary ? `\nSummary of the earlier conversation:\n${summary}` : "") }, ...turns],
        signal: controller.signal,
        think: thinks(),
        incognito,
        onText: (content, stats, thought) => update({ content, thought, ...stats }),
        onTools: (tools) => update({ tools, sources: [...new Map([...sources, ...tools.flatMap((tool) => tool.sources ?? [])].map((source) => [source.id, source])).values()] }),
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        latest = { ...latest, content: `Something went wrong: ${(error as Error).message}` };
      }
    } finally {
      cancelAnimationFrame(frame);
      const final = latest.content || latest.thought || latest.tools ? [...history, latest] : history;
      if (!incognito) saveMessages(chat.id, final);
      setMessages(final);
      if (cut === 0 && chat.name === "Chat" && !incognito && latest.content && !controller.signal.aborted) {
        try {
          const name = await nameChat(text, controller.signal);
          if (name) onTitle(name);
        } catch {
          // keeps the quick title
        }
      }
      setBusy(false);
    }
  }

  // Regenerates an answer, first switching to another model when one is given
  async function retry(index: number, id?: string) {
    if (id && id !== model.id) await pick(id);
    void send(messages[index - 1].content, index - 1);
  }

  // Downloads this chat as Markdown or a standalone HTML page
  async function share(format: string) {
    const text = markdown(chat.name, messages);
    if (format === "md") return download(`${chat.name}.md`, text, "text/markdown");
    const { escape, render } = await import("@/components/markdown");
    const style = "body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:16px/1.6 system-ui,sans-serif;color-scheme:light dark}pre{overflow:auto;padding:1rem;border-radius:.5rem;background:#8882}";
    download(`${chat.name}.html`, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(chat.name)}</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.19.0/dist/katex.min.css"><style>${style}</style>${render(text).replace(/<button[^>]*data-preview[^>]*>Preview<\/button>/g, "")}`, "text/html");
  }

  // Stable row callbacks use the latest history and attachments after each commit.
  const current = useRef({ send, retry, onFork, messages });
  useLayoutEffect(() => { current.current = { send, retry, onFork, messages }; });
  const edit = useCallback((text: string, index: number) => void current.current.send(text, index), []);
  const fork = useCallback((index: number) => current.current.onFork(current.current.messages.slice(0, index + 1)), []);
  const redo = useCallback((index: number, id?: string) => void current.current.retry(index, id), []);

  const empty = messages.length === 0;
  const composer = (
    <Composer
      input={input}
      setInput={setInput}
      busy={busy}
      tall={empty}
      files={attachments.files}
      onAttach={(files) => void attachments.attach(files)}
      onDetach={attachments.detach}
      onSend={() => void send(input)}
      onQueue={() => queue(input)}
      onStop={() => {
        next.current = "";
        abort.current?.abort();
      }}
    />
  );

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <div inert={!!source && mobile} className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <Artifact />
        <Header title={empty ? "Locus" : chat.name} incognito={incognito} setIncognito={setIncognito} empty={empty} onNew={onNew} onShare={(format) => void share(format)} />

        <div
          ref={scroller}
          className={`absolute inset-0 overflow-y-auto overscroll-contain px-4 pt-20 [overflow-anchor:none] sm:px-6 ${empty ? "pb-6" : "fade pb-44"}`}
          onScroll={(event) => {
            const element = event.currentTarget;
            // Content growing below the viewport is not an upward scroll.
            stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96 || (stick.current && element.scrollTop >= position.current);
            position.current = element.scrollTop;
            element.style.overflowAnchor = stick.current ? "none" : "auto";
            if (element.scrollTop < 1000) earlier();
          }}
        >
          {empty ? (
            <Empty className="min-h-full gap-7 rounded-none p-0 py-8">
              <EmptyHeader className="max-w-lg gap-3">
                <EmptyTitle className="text-[2rem] leading-tight font-semibold tracking-[-0.03em] sm:text-4xl"><h1>{incognito ? "Incognito chat" : greet(name)}</h1></EmptyTitle>
                <EmptyDescription>{incognito ? "This conversation won't appear in your history." : "Chat with a model running on your device."}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="max-w-2xl gap-5">
                {composer}
                <div className="grid w-full gap-1 px-1 sm:grid-cols-2">
                  {prompts.map((prompt) => (
                    <Button key={prompt} variant="ghost" className="h-auto min-h-10 justify-start px-3 py-2 text-left text-sm font-normal whitespace-normal text-muted-foreground hover:text-foreground" onClick={() => setInput(() => prompt)}>
                      {prompt}
                    </Button>
                  ))}
                </div>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {start > 0 && <Button variant="ghost" onClick={earlier}>Load earlier messages</Button>}
              {messages.slice(start).map((message, offset) => {
                const index = start + offset;
                return (
                  <Turn
                    key={message.id}
                    message={message}
                    index={index}
                    last={index === messages.length - 1}
                    busy={busy}
                    nerd={nerd}
                    think={think}
                    onSource={open}
                    onEdit={edit}
                    onFork={fork}
                    onRetry={redo}
                  />
                );
              })}
            </div>
          )}
        </div>

        {!empty && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="pointer-events-auto mx-auto max-w-3xl">
              <Permit />
              <Question />
              {composer}
            </div>
          </div>
        )}
      </div>
      <Suspense fallback={<p role="status" className="absolute inset-0 z-30 bg-background p-4 md:static md:w-[45%]">Loading document…</p>}>
        {source && <Source source={source} onClose={close} />}
      </Suspense>
    </div>
  );
}
