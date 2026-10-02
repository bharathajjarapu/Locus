import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon, Cancel01Icon, Copy01Icon, GhostIcon, GitForkIcon, Moon02Icon, PencilEdit01Icon, RefreshIcon, Sun03Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Composer, frame } from "@/components/composer";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { nameChat, options, reply } from "@/lib/llm";
import { getMessages, greet, saveMessages, title, trim, uid, type Chat as ChatTab, type Message as Entry } from "@/lib/store";

// Markdown pulls in KaTeX and Prism, so it loads after first paint
const Markdown = lazy(() => import("@/components/markdown"));

type Props = {
  chat: ChatTab;
  name: string;
  nerd: boolean;
  onTitle: (name: string) => void;
  onFork: (messages: Entry[]) => void;
};

const prompts = [
  "Explain a concept like I'm new to it",
  "Draft a concise follow-up email",
  "Give me three ideas for a weekend project",
  "Summarize the pros and cons of remote work",
];

// Off-screen rows skip layout and paint, so long chats stay fast while streaming
const row = "[contain-intrinsic-size:auto_6rem] [content-visibility:auto]";
// Row actions fade in on hover on desktop, always visible on touch
const actions = "gap-0.5 transition-opacity md:opacity-0 md:group-hover/message:opacity-100 md:focus-within:opacity-100";

// Builds the system prompt for each request
const system = (name: string) =>
  `You are Locus, a helpful assistant running privately in the user's browser. Answer clearly and concisely. Use Markdown when it helps, $...$ for inline math and $$...$$ for display math.${name ? ` The user's name is ${name}.` : ""} Current date: ${new Date().toDateString()}.`;

export function Chat({ chat, name, nerd, onTitle, onFork }: Props) {
  const [messages, setMessages] = useState(() => getMessages(chat.id));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [incognito, setIncognito] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [copied, setCopied] = useState("");
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

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
    const history: Entry[] = [...messages.slice(0, cut), { id: uid(), role: "user", content: text }];
    const answer: Entry = { id: uid(), role: "assistant", content: "" };
    let latest = answer;
    let frame = 0;
    const flush = () => {
      frame = 0;
      setMessages((list) => list.map((message) => (message.id === answer.id ? latest : message)));
    };

    setMessages([...history, answer]);
    setInput("");
    setEditing(null);
    setBusy(true);
    stick.current = true;
    if (cut === 0 && chat.name === "Chat" && !incognito) onTitle(title(text));

    const controller = new AbortController();
    abort.current = controller;
    try {
      const turns = trim(history, options().n_ctx * 2).map(({ role, content }) => ({ role, content }));
      await reply([{ role: "system", content: system(name) }, ...turns], controller.signal, (content, stats) => {
        latest = { ...latest, content, ...stats };
        frame ||= requestAnimationFrame(flush);
      });
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        latest = { ...latest, content: `Something went wrong: ${(error as Error).message}` };
      }
    } finally {
      cancelAnimationFrame(frame);
      const final = latest.content ? [...history, latest] : history;
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

  // Copies a message and briefly marks it as copied
  function copy(message: Entry) {
    void navigator.clipboard.writeText(message.content);
    setCopied(message.id);
    setTimeout(() => setCopied(""), 2000);
  }

  // Toggles dark mode and remembers the choice
  function toggleTheme() {
    const apply = () => document.documentElement.classList.toggle("dark", !dark);
    if (document.startViewTransition) document.startViewTransition(apply);
    else apply();
    localStorage.setItem("darkMode", String(!dark));
    setDark(!dark);
  }

  const empty = messages.length === 0;
  const composer = (
    <Composer
      input={input}
      setInput={setInput}
      busy={busy}
      tall={empty}
      onSend={() => void send(input)}
      onStop={() => abort.current?.abort()}
    />
  );
  const copyButton = (message: Entry) => (
    <Button variant="ghost" size="icon-sm" aria-label="Copy" onClick={() => copy(message)}>
      {copied === message.id ? <HugeiconsIcon icon={Tick02Icon} /> : <HugeiconsIcon icon={Copy01Icon} />}
    </Button>
  );

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-14 items-center gap-2 px-4 *:pointer-events-auto">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <h1 className="truncate font-medium">{incognito ? "Incognito" : chat.name}</h1>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={incognito ? "secondary" : "ghost"}
            size="icon-lg"
            aria-label="Incognito"
            disabled={!incognito && !empty}
            onClick={() => {
              if (incognito) setMessages([]);
              setIncognito(!incognito);
            }}
          >
            <HugeiconsIcon icon={GhostIcon} />
          </Button>
          <Button variant="ghost" size="icon-lg" aria-label={dark ? "Light mode" : "Dark mode"} onClick={toggleTheme}>
            {dark ? <HugeiconsIcon icon={Sun03Icon} /> : <HugeiconsIcon icon={Moon02Icon} />}
          </Button>
        </div>
      </header>

      <div
        ref={scroller}
        className={`absolute inset-0 overflow-y-auto p-4 pt-16 ${empty ? "" : "pb-28"}`}
        onScroll={(event) => {
          const element = event.currentTarget;
          stick.current = element.scrollHeight - element.scrollTop - element.clientHeight < 96;
        }}
      >
        {empty ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyTitle className="text-3xl">{incognito ? "Incognito" : greet(name)}</EmptyTitle>
              <EmptyDescription>
                {incognito ? "This chat won't be saved." : "Ask anything. Everything stays on your device."}
              </EmptyDescription>
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
            {messages.map((message, index) =>
              message.role === "user" ? (
                <Message key={message.id} align="end" className={row}>
                  <MessageContent>
                    {editing?.id === message.id ? (
                      <InputGroup className={`${frame} w-full`}>
                        <InputGroupTextarea
                          autoFocus
                          rows={1}
                          className="max-h-48 min-h-0"
                          value={editing.text}
                          onChange={(event) => setEditing({ id: message.id, text: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") setEditing(null);
                            if (event.key === "Enter" && !event.shiftKey && editing.text.trim()) {
                              event.preventDefault();
                              void send(editing.text, index);
                            }
                          }}
                        />
                        <InputGroupAddon align="inline-end" className="self-end">
                          <InputGroupButton variant="ghost" size="icon-sm" aria-label="Cancel" onClick={() => setEditing(null)}>
                            <HugeiconsIcon icon={Cancel01Icon} />
                          </InputGroupButton>
                          <InputGroupButton variant="default" size="icon-sm" aria-label="Send" disabled={!editing.text.trim()} onClick={() => void send(editing.text, index)}>
                            <HugeiconsIcon icon={ArrowUp02Icon} />
                          </InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>
                    ) : (
                      <div className="flex max-w-full items-center gap-1 self-end">
                        <MessageFooter className={`${actions} px-0`}>
                          <Button variant="ghost" size="icon-sm" aria-label="Edit" disabled={busy} onClick={() => setEditing({ id: message.id, text: message.content })}>
                            <HugeiconsIcon icon={PencilEdit01Icon} />
                          </Button>
                          {copyButton(message)}
                        </MessageFooter>
                        <Bubble variant="secondary" className="max-w-full">
                          <BubbleContent className="text-base whitespace-pre-wrap">{message.content}</BubbleContent>
                        </Bubble>
                      </div>
                    )}
                  </MessageContent>
                </Message>
              ) : (
                <Message key={message.id} className={row}>
                  <MessageContent>
                    <Bubble variant="ghost">
                      <BubbleContent className="text-base">
                        {message.content ? (
                          <Suspense fallback={<p className="whitespace-pre-wrap">{message.content}</p>}>
                            <Markdown text={message.content} />
                          </Suspense>
                        ) : (
                          <Spinner className="my-1.5" />
                        )}
                      </BubbleContent>
                    </Bubble>
                    {!(busy && index === messages.length - 1) && (
                      <MessageFooter className={actions}>
                        {copyButton(message)}
                        <Button variant="ghost" size="icon-sm" aria-label="Fork" onClick={() => onFork(messages.slice(0, index + 1))}>
                          <HugeiconsIcon icon={GitForkIcon} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label="Retry" disabled={busy} onClick={() => void send(messages[index - 1].content, index - 1)}>
                          <HugeiconsIcon icon={RefreshIcon} />
                        </Button>
                        {nerd && message.speed != null && (
                          <span className="ml-1 text-sm font-normal tabular-nums">
                            {message.speed.toFixed(1)} tok/s · {message.tokens} tokens
                          </span>
                        )}
                      </MessageFooter>
                    )}
                  </MessageContent>
                </Message>
              ),
            )}
          </div>
        )}
      </div>

      {!empty && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4">
          <div className="pointer-events-auto mx-auto max-w-3xl">{composer}</div>
        </div>
      )}
    </div>
  );
}
