import { useEffect, useRef, useState } from "react";

// Browser speech recognition, missing on some browsers
type Recognition = {
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: (event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onerror: (event: { error: string }) => void;
  onend: () => void;
};
const api = window as unknown as Record<string, (new () => Recognition) | undefined>;
const Speech = api.SpeechRecognition ?? api.webkitSpeechRecognition;

// Dictation that hands each recognised phrase to onText
export function useSpeech(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const active = useRef<Recognition | null>(null);

  useEffect(() => () => active.current?.stop(), []);

  // Starts or stops listening
  function listen() {
    if (active.current) return active.current.stop();
    if (!Speech) return setError("Speech recognition is not supported in this browser.");
    const recognition = new Speech();
    recognition.continuous = true;
    recognition.onresult = (event) => onText(Array.from(event.results).slice(event.resultIndex).map((result) => result[0].transcript).join(" "));
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") setError(`Speech error: ${event.error}`);
    };
    recognition.onend = () => {
      active.current = null;
      setListening(false);
    };
    recognition.start();
    active.current = recognition;
    setListening(true);
    setError("");
  }

  return { listening, error, listen, dismiss: () => setError("") };
}
