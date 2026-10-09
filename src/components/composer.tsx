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
  onStop: () => void;
};

const choices = models.map((item) => ({ value: item.id, label: item.name }));

// Input box style shared with message editing
export const frame =
  "border-2 bg-card/90 dark:bg-card/90 dark:border-secondary has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:has-[[data-slot=input-group-control]:focus-visible]:border-ring";

export function Composer({ input, setInput, busy, tall, files, onAttach, onDetach, onSend, onStop }: Props) {
  const { model, think, status, progress, error } = useModel();
  const speech = useSpeech((text) => setInput((value) => `${value} ${text}`.trim()));
  const failed = status === "error" && !speech.error;
  const problem = failed ? error : speech.error;
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  // Sending waits until every attached file is read
  const reading = files.some((file) => file.status === "reading" || file.status === "indexing");

  // The pieces are shared by the tall home layout and the compact chat layout
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
          <HugeiconsIcon icon={AiBrain01Icon} /> Think
        </InputGroupButton>
      )}
      <Pick compact label="Model" items={choices} value={model.id} onChange={(id) => void pick(id)} disabled={busy || status === "loading"}>
        {status === "loading" ? (
          <span className="fill animate-pulse" style={{ "--p": `${Math.round(progress * 100)}%` } as CSSProperties}>
            {model.name}
          </span>
        ) : (
          model.name
        )}
      </Pick>
      {busy ? (
        <InputGroupButton variant="default" size="icon-sm" aria-label="Stop" onClick={onStop}>
          <HugeiconsIcon icon={StopIcon} />
        </InputGroupButton>
      ) : input.trim() && !speech.listening ? (
        <InputGroupButton variant="default" size="icon-sm" aria-label="Send" disabled={reading} onClick={onSend}>
          <HugeiconsIcon icon={ArrowUp02Icon} />
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
      value={input}
      placeholder="Message…"
      rows={1}
      className={tall ? "max-h-48 min-h-9" : "max-h-48 min-h-0"}
      onChange={(event) => setInput(() => event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          if (speech.listening) void speech.listen();
          else if (!busy && !reading) onSend();
        }
      }}
    />
  );

  return (
    <div className="w-full space-y-2">
      {speech.listening && <p role="status" className="text-sm text-muted-foreground">{speech.status || "Listening…"}</p>}
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
        className={cn(frame, files.length > 0 && !tall && "flex-wrap", dragging && "ring-2 ring-ring")}
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
        {tall ? (
          <>
            {textarea}
            <InputGroupAddon align="block-end" className="justify-between">
              {attach}
              <div className="flex items-center gap-1">{controls}</div>
            </InputGroupAddon>
          </>
        ) : (
          <>
            <InputGroupAddon align="inline-start" className="self-end">
              {attach}
            </InputGroupAddon>
            {textarea}
            <InputGroupAddon align="inline-end" className="self-end">
              {controls}
            </InputGroupAddon>
          </>
        )}
      </InputGroup>
    </div>
  );
}
