import { useRef, useState, type CSSProperties } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiBrain01Icon, ArrowUp02Icon, Attachment01Icon, Mic01Icon, StopIcon } from "@hugeicons/core-free-icons";
import { Chip } from "@/components/chip";
import { Pick } from "@/components/pick";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from "@/components/ui/group";
import type { Attachment } from "@/lib/attach";
import { preload, pick, toggleThink, useModel } from "@/lib/llm";
import { models } from "@/lib/models";
import { skills } from "@/lib/prompt";
import { useSpeech } from "@/lib/speech";
import { cn } from "@/lib/utils";

type Props = {
  input: string;
  setInput: (update: (value: string) => string) => void;
  busy: boolean;
  tall?: boolean;
  files: Attachment[];
  onAttach: (files: File[]) => void;
  onDetach: (id: string) => void;
  onSend: () => void;
  onQueue: () => void;
  onStop: () => void;
};

export const choices = models.map((item) => ({ value: item.id, label: item.name }));

// Input box style shared with message editing
export const frame =
  "rounded-2xl border border-input bg-card dark:bg-card has-disabled:bg-card has-disabled:opacity-100 dark:has-disabled:bg-card";

export function Composer({ input, setInput, busy, tall, files, onAttach, onDetach, onSend, onQueue, onStop }: Props) {
  const { model, think, status, progress, error } = useModel();
  const speech = useSpeech((text) => setInput((value) => `${value} ${text}`.trim()));
  const failed = status === "error" && !speech.error;
  const problem = failed ? error : speech.error;
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  // Sending waits until every attached file is read
  const matches = /^\/\S*$/.test(input) ? skills().filter((skill) => skill.name && skill.name.startsWith(input.slice(1))) : [];
  const reading = files.some((file) => file.status === "reading" || file.status === "indexing");

  const attach = (
    <>
      <InputGroupButton variant="ghost" size="icon-sm" aria-label="Attach files" onClick={() => picker.current?.click()}>
        <HugeiconsIcon icon={Attachment01Icon} />
      </InputGroupButton>
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          onAttach(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </>
  );
  const controls = (
    <>
      {model.think && (
        <InputGroupButton variant={think ? "secondary" : "ghost"} size="xs" aria-label="Thinking" aria-pressed={think} disabled={busy} onClick={toggleThink}>
          <HugeiconsIcon icon={AiBrain01Icon} /><span className="hidden sm:inline">Think</span>
        </InputGroupButton>
      )}
      <Pick compact label="Model" items={choices} value={model.id} onChange={(id) => void pick(id)} disabled={busy || status === "loading"}>
        {status === "loading" ? (
          <span className="fill max-w-36 truncate animate-pulse" style={{ "--p": `${Math.round(progress * 100)}%` } as CSSProperties}>
            {model.name}
          </span>
        ) : (
          <span className="max-w-36 truncate" title={model.name}>{model.name}</span>
        )}
      </Pick>
      {input.trim() && !speech.listening ? (
        <InputGroupButton variant="default" size="icon-sm" aria-label={busy ? "Steer" : "Send"} disabled={reading} onClick={onSend}>
          <HugeiconsIcon icon={ArrowUp02Icon} />
        </InputGroupButton>
      ) : busy ? (
        <InputGroupButton variant="default" size="icon-sm" aria-label="Stop" onClick={onStop}>
          <HugeiconsIcon icon={StopIcon} />
        </InputGroupButton>
      ) : (
        <InputGroupButton
          variant={speech.listening ? "destructive" : "ghost"}
          size="icon-sm"
          aria-label={speech.listening ? "Stop dictation" : "Dictate"}
          aria-pressed={speech.listening}
          title={speech.status || (speech.listening ? "Stop dictation" : "Dictate in English")}
          onClick={speech.listen}
        >
          {speech.status ? <Spinner /> : <HugeiconsIcon icon={speech.listening ? StopIcon : Mic01Icon} />}
        </InputGroupButton>
      )}
    </>
  );
  const textarea = (
    <InputGroupTextarea
      autoFocus
      aria-label="Message"
      value={input}
      placeholder={busy ? "Enter to steer, Tab to queue…" : "Message…"}
      rows={1}
      className={cn("max-h-48 px-4 pt-4 pb-3 text-base leading-6", tall ? "min-h-24" : "min-h-14")}
      onChange={(event) => setInput(() => event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Tab" && busy && input.trim()) {
          event.preventDefault();
          onQueue();
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          if (speech.listening) void speech.listen();
          else if (!reading) onSend();
        }
      }}
    />
  );

  return (
    <div className="w-full space-y-2">
      {speech.listening && <p role="status" className="text-sm text-muted-foreground">{speech.status || "Listening…"}</p>}
      {matches.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {matches.map((skill) => (
            <Button key={skill.name} variant="outline" size="xs" title={skill.text} onClick={() => setInput(() => `/${skill.name} `)}>
              /{skill.name}
            </Button>
          ))}
        </div>
      )}
      {problem && (
        <Alert variant={failed ? "destructive" : "default"}>
          <AlertDescription>{problem}</AlertDescription>
          <AlertAction>
            {failed ? (
              <Button size="xs" variant="outline" onClick={() => void preload()}>
                Retry
              </Button>
            ) : (
              <Button size="xs" variant="ghost" onClick={speech.dismiss}>
                Dismiss
              </Button>
            )}
          </AlertAction>
        </Alert>
      )}
      <InputGroup
        className={cn(frame, dragging && "ring-2 ring-ring")}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => !event.currentTarget.contains(event.relatedTarget as Node) && setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onAttach(Array.from(event.dataTransfer.files));
        }}
      >
        {files.length > 0 && (
          <div className="order-first flex w-full flex-wrap gap-1.5 px-2.5 pt-2">
            {files.map((file) => (
              <Chip key={file.id} name={file.name} status={file.status} error={file.error} onRemove={() => onDetach(file.id)} />
            ))}
          </div>
        )}
        {textarea}
        <InputGroupAddon align="block-end" className="justify-between gap-1 px-2.5 pb-2.5">
          {attach}
          <div className="flex min-w-0 items-center gap-1">{controls}</div>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
