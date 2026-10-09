import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon, Cancel01Icon, Copy01Icon, GitForkIcon, PencilEdit01Icon, RefreshIcon, StopIcon, Tick02Icon, VolumeHighIcon } from "@hugeicons/core-free-icons";
import { Chip } from "@/components/chip";
import { frame } from "@/components/composer";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/group";
import { Message, MessageContent, MessageFooter } from "@/components/ui/message";
import { Spinner } from "@/components/ui/spinner";
import { speak, stop, useVoice } from "@/lib/speech";
import type { Message as Entry, Source } from "@/lib/store";

// Markdown pulls in KaTeX and Prism, so it loads after first paint
const Markdown = lazy(() => import("@/components/markdown"));

// Off-screen rows skip layout and paint, so long chats stay fast while streaming
const row = "[contain-intrinsic-size:auto_6rem] [content-visibility:auto]";
// Row actions fade in on hover on desktop, always visible on touch
const actions = "gap-0.5 transition-opacity md:opacity-0 md:group-hover/message:opacity-100 md:focus-within:opacity-100";

type Props = {
  message: Entry;
  last: boolean;
  busy: boolean;
  nerd: boolean;
  think: boolean;
  onEdit: (text: string) => void;
  onFork: () => void;
  onRetry: () => void;
  onSource: (source: Source) => void;
};

// Copies text and briefly shows a tick
function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
    >
      <HugeiconsIcon icon={done ? Tick02Icon : Copy01Icon} />
    </Button>
  );
}

// Collapsible section with a label and the details underneath
function Fold({ label, open, children }: { label: ReactNode; open?: boolean; children?: ReactNode }) {
  return (
    <details className="mb-2 text-muted-foreground" open={open}>
      <summary className="cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden">{label}</summary>
      {children && <p className="mt-1 border-l-2 pl-3 text-sm whitespace-pre-wrap">{children}</p>}
    </details>
  );
}

// One message in the chat, either from the user or the model
export function Turn({ message, last, busy, nerd, think, onEdit, onFork, onRetry, onSource }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const voice = useVoice();
  const reading = voice.id === message.id && voice.playing;
  const waiting = busy && last && !message.content;
  useEffect(() => () => stop(message.id), [message.id, message.content]);

  if (message.role === "user") {
    return (
      <Message align="end" className={row}>
        <MessageContent>
          {draft === null ? (
            <div className="flex max-w-full items-center gap-1 self-end">
              <MessageFooter className={`${actions} px-0`}>
                <Button variant="ghost" size="icon-sm" aria-label="Edit" disabled={busy} onClick={() => setDraft(message.content)}>
                  <HugeiconsIcon icon={PencilEdit01Icon} />
                </Button>
                <Copy text={message.content} />
              </MessageFooter>
              <div className="flex max-w-full flex-col items-end gap-1.5">
                {message.files && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {message.files.map((file, index) => (
                      <Chip key={index} name={file.name} />
                    ))}
                  </div>
                )}
                <Bubble variant="secondary" className="max-w-full">
                  <BubbleContent className="text-base whitespace-pre-wrap">{message.content}</BubbleContent>
                </Bubble>
              </div>
            </div>
          ) : (
            <InputGroup className={`${frame} w-full`}>
              <InputGroupTextarea
                autoFocus
                rows={1}
                className="max-h-48 min-h-0"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setDraft(null);
                  if (event.key === "Enter" && !event.shiftKey && draft.trim()) {
                    event.preventDefault();
                    onEdit(draft);
                  }
                }}
              />
              <InputGroupAddon align="inline-end" className="self-end">
                <InputGroupButton variant="ghost" size="icon-sm" aria-label="Cancel" onClick={() => setDraft(null)}>
                  <HugeiconsIcon icon={Cancel01Icon} />
                </InputGroupButton>
                <InputGroupButton variant="default" size="icon-sm" aria-label="Send" disabled={!draft.trim()} onClick={() => onEdit(draft)}>
                  <HugeiconsIcon icon={ArrowUp02Icon} />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          )}
        </MessageContent>
      </Message>
    );
  }

  return (
    <Message className={row}>
      <MessageContent>
        <Bubble variant="ghost">
          <BubbleContent className="text-base">
            {(message.thought || (waiting && think)) && (
              <Fold label={waiting ? <span className="shimmer">Thinking…</span> : "Thought process"} open={waiting}>
                {message.thought}
              </Fold>
            )}
            {message.tools?.map((tool, index) => (
              <Fold key={index} label={`${tool.denied ? "Denied" : "Used"} ${tool.name}`}>
                {`${tool.args}\n\n${tool.result.slice(0, 600)}`}
              </Fold>
            ))}
            {message.content ? (
              <Suspense fallback={<p className="whitespace-pre-wrap">{message.content}</p>}>
                <Markdown text={message.content} sources={message.sources} onSource={onSource} />
              </Suspense>
            ) : (
              !message.thought && !think && <span className="shimmer">Thinking…</span>
            )}
          </BubbleContent>
        </Bubble>
        {!!message.sources?.length && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Sources · {message.sources.length}</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {message.sources.map((source, index) => <Button key={source.id} variant="outline" size="sm" className="h-auto max-w-full whitespace-normal text-left" onClick={() => onSource(source)}>{index + 1}. {source.name}{source.page ? ` · p. ${source.page}` : ""}</Button>)}
            </div>
          </details>
        )}
        {!(busy && last) && (
          <MessageFooter className={reading ? "gap-0.5" : actions}>
            <Copy text={message.content} />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={reading ? "Stop reading" : "Read aloud"}
              title={reading ? "Stop reading" : "Read aloud"}
              aria-pressed={reading}
              disabled={!message.content.trim()}
              onClick={() => reading ? stop(message.id) : void speak(message.id, message.content)}
            >
              {reading && voice.loading ? <Spinner aria-label="Loading voice" /> : <HugeiconsIcon icon={reading ? StopIcon : VolumeHighIcon} />}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Fork" onClick={onFork}>
              <HugeiconsIcon icon={GitForkIcon} />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Retry" disabled={busy} onClick={onRetry}>
              <HugeiconsIcon icon={RefreshIcon} />
            </Button>
            {nerd && message.speed != null && (
              <span className="ml-1 text-sm font-normal tabular-nums">
                {message.speed.toFixed(1)} tok/s · {message.tokens} tokens
              </span>
            )}
          </MessageFooter>
        )}
        {voice.id === message.id && voice.error && <p role="alert" className="text-sm text-destructive">{voice.error}</p>}
      </MessageContent>
    </Message>
  );
}
