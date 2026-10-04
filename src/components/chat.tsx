import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Composer } from "@/components/composer";
import { Header } from "@/components/header";
import { Permit } from "@/components/permit";
import { Turn } from "@/components/turn";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { run } from "@/lib/agent";
import { useAttachments } from "@/lib/attach";
import { nameChat, useModel, type Turn as Prompt } from "@/lib/llm";
import { options } from "@/lib/models";
import { recall } from "@/lib/memory";
import { system, withFiles } from "@/lib/prompt";
import { getMessages, greet, saveMessages, title, trim, uid, type Chat as ChatTab, type Message as Entry } from "@/lib/store";

type Props = {
  chat: ChatTab;
  name: string;
  nerd: boolean;
  onTitle: (name: string) => void;
  onFork: (messages: Entry[]) => void;
  onNew: () => void;
};

const prompts = ["Explain a concept like I'm new to it", "Draft a concise follow-up email", "Give me three ideas for a weekend project", "Summarize the pros and cons of remote work"];

export function Chat({ chat, name, nerd, onTitle, onFork, onNew }: Props) {
  const [messages, setMessages] = useState(() => getMessages(chat.id));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [incognito, setIncognito] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const { think } = useModel();
  const attachments = useAttachments();

  useEffect(() => {
    if (!busy && !incognito) saveMessages(chat.id, messages);
  }, [chat.id, messages, busy, incognito]);

  useEffect(() => () => abort.current?.abort(), []);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (element && stick.current) element.scrollTop = element.scrollHeight;
  }, [messages]);

  // Sends a message, replacing history from `cut` onward, and streams the reply
  async function send(text: string, cut = messages.length) {
    if (!text.trim() || busy) return;
    // Edits keep the files the original message had
    const isNew = cut === messages.length;
    const files = isNew ? attachments.ready() : messages[cut]?.files;
    const images = isNew ? attachments.images() : [];
    const history: Entry[] = [...messages.slice(0, cut), { id: uid(), role: "user", content: text, ...(files?.length && { files }) }];
    const answer: Entry = { id: uid(), role: "assistant", content: "" };
    let latest = answer;
    let frame = 0;
    const flush = () => {
      frame = 0;
      setMessages((list) => list.map((message) => (message.id === answer.id ? latest : message)));
    };

    setMessages([...history, answer]);
    setInput("");
    attachments.clear();
    setBusy(true);
    stick.current = true;
    if (cut === 0 && chat.name === "Chat" && !incognito) onTitle(title(text, 2));

    const controller = new AbortController();
    abort.current = controller;
    try {
      const turns: Prompt[] = trim(
        history.map((message) => ({ ...message, content: withFiles(message) })),
        options().n_ctx * 2,
      ).map(({ role, content }) => ({ role, content }));
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
        turns: [{ role: "system", content: system(name, facts.map((fact) => fact.text)) }, ...turns],
        signal: controller.signal,
        think,
        incognito,
        onText: (content, stats, thought) => update({ content, thought, ...stats }),
        onTools: (tools) => update({ tools }),
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
      onStop={() => abort.current?.abort()}
    />
  );

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <Header incognito={incognito} setIncognito={setIncognito} empty={empty} onNew={onNew} />

      <div
        ref={scroller}
        className={`absolute inset-0 overflow-y-auto p-4 pt-16 ${empty ? "" : "fade pb-28"}`}
        onScroll={(event) => {
          const element = event.currentTarget;
          stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
        }}
      >
        {empty ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyTitle className="text-3xl">{incognito ? "Incognito" : greet(name)}</EmptyTitle>
              <EmptyDescription>{incognito ? "This chat won't be saved." : "Ask anything. Everything stays on your device."}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="max-w-2xl">
              {composer}
              <div className="grid w-full gap-2 sm:grid-cols-2">
                {prompts.map((prompt) => (
                  <Button key={prompt} variant="outline" className="h-auto justify-start py-2 text-left whitespace-normal" onClick={() => setInput(() => prompt)}>
                    {prompt}
                  </Button>
                ))}
              </div>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.map((message, index) => (
              <Turn
                key={message.id}
                message={message}
                last={index === messages.length - 1}
                busy={busy}
                nerd={nerd}
                think={think}
                onEdit={(text) => void send(text, index)}
                onFork={() => onFork(messages.slice(0, index + 1))}
                onRetry={() => void send(messages[index - 1].content, index - 1)}
              />
            ))}
          </div>
        )}
      </div>

      {!empty && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4">
          <div className="pointer-events-auto mx-auto max-w-3xl">
            <Permit />
            {composer}
          </div>
        </div>
      )}
    </div>
  );
}
