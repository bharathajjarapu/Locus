import { useEffect, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUp02Icon, Mic01Icon, StopIcon } from "@hugeicons/core-free-icons";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupText, InputGroupTextarea } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { load, model, useModel } from "@/lib/llm";

type Props = {
  input: string;
  setInput: (update: (value: string) => string) => void;
  busy: boolean;
  tall?: boolean;
  onSend: () => void;
  onStop: () => void;
};

// Browser speech recognition, missing on some browsers
type Speech = {
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: (event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
};
const speechApi = window as unknown as Record<string, (new () => Speech) | undefined>;
const Recognition = speechApi.SpeechRecognition ?? speechApi.webkitSpeechRecognition;

// Input box style shared with message editing
export const frame = "border-2 bg-card/90 dark:bg-card/90 dark:border-secondary has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:has-[[data-slot=input-group-control]:focus-visible]:border-ring";

export function Composer({ input, setInput, busy, tall, onSend, onStop }: Props) {
  const { status, progress, error } = useModel();
  const [notice, setNotice] = useState("");
  const [listening, setListening] = useState(false);
  const speech = useRef<Speech | null>(null);

  useEffect(() => () => speech.current?.stop(), []);

  // Starts or stops dictation into the input
  function listen() {
    if (speech.current) return speech.current.stop();
    if (!Recognition) return setNotice("Speech recognition is not supported in this browser.");
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const text = Array.from(event.results).slice(event.resultIndex).map((result) => result[0].transcript).join(" ");
      setInput((value) => `${value} ${text}`.trim());
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") setNotice(`Speech error: ${event.error}`);
    };
    recognition.onend = () => {
      speech.current = null;
      setListening(false);
    };
    recognition.start();
    speech.current = recognition;
    setListening(true);
    setNotice("");
  }

  const problem = status === "error" ? error : notice;

  return (
    <div className="w-full space-y-2">
      {problem && (
        <Alert variant={status === "error" ? "destructive" : "default"}>
          <AlertDescription>{problem}</AlertDescription>
          <AlertAction>
            {status === "error" ? (
              <Button size="xs" variant="outline" onClick={() => void load().catch(() => {})}>
                Retry
              </Button>
            ) : (
              <Button size="xs" variant="ghost" onClick={() => setNotice("")}>
                Dismiss
              </Button>
            )}
          </AlertAction>
        </Alert>
      )}
      <InputGroup className={frame}>
        <InputGroupTextarea
          autoFocus
          value={input}
          placeholder="Message…"
          rows={1}
          className={tall ? "max-h-48 min-h-20" : "max-h-48 min-h-0"}
          onChange={(event) => setInput(() => event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (!busy) onSend();
            }
          }}
        />
        <InputGroupAddon align="inline-end" className="self-end">
          {status === "loading" && (
            <InputGroupText>
              <Spinner /> Loading {model.name} {Math.round(progress * 100)}%
            </InputGroupText>
          )}
          {busy ? (
            <InputGroupButton variant="default" size="icon-sm" className="ml-auto" aria-label="Stop" onClick={onStop}>
              <HugeiconsIcon icon={StopIcon} />
            </InputGroupButton>
          ) : input.trim() ? (
            <InputGroupButton variant="default" size="icon-sm" className="ml-auto" aria-label="Send" onClick={onSend}>
              <HugeiconsIcon icon={ArrowUp02Icon} />
            </InputGroupButton>
          ) : (
            <InputGroupButton
              variant={listening ? "destructive" : "ghost"}
              size="icon-sm"
              className="ml-auto"
              aria-label={listening ? "Stop dictation" : "Dictate"}
              onClick={listen}
            >
              {listening ? <HugeiconsIcon icon={StopIcon} /> : <HugeiconsIcon icon={Mic01Icon} />}
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
