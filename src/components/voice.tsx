import { useEffect, useState } from "react";
import { Pick } from "@/components/pick";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { useSaved } from "@/lib/saved";
import { fetchVoice, forgetVoice, speakers, speak, stop, storedVoice, unloadVoice, useVoice } from "@/lib/speech";

// Read-aloud voice, playback speed and dictation model rows, shown in Models.
export function Voice() {
  const [speaker, setSpeaker] = useSaved<string>("speaker", speakers[0].value);
  const [rate, setRate] = useSaved<string>("voiceRate", "1");
  const [size, setSize] = useState<number | null>(null);
  const [problem, setProblem] = useState("");
  const [fetching, setFetching] = useState(false);
  const { playing, loading, dictating, id, error, sizes } = useVoice();
  const selected = speakers.some((item) => item.value === speaker) ? speaker : speakers[0].value;
  const speed = Math.min(1.5, Math.max(0.75, Number(rate) || 1));
  const total = Object.values(sizes).reduce((sum, bytes) => sum + bytes, 0);

  useEffect(() => {
    let active = true;
    storedVoice().then((bytes) => { if (active) setSize(bytes); }).catch((error: Error) => { if (active) { setSize(0); setProblem(error.message); } });
    return () => { active = false; };
  }, [dictating]);
  useEffect(() => () => stop("preview"), []);

  // Deletes cached dictation weights without changing chat models or messages.
  async function clear() {
    setProblem("");
    try { await forgetVoice(); setSize(0); }
    catch (error) { setProblem(error instanceof Error ? error.message : "Couldn't delete the download. Try again."); }
  }

  // Downloads dictation weights now instead of on first use.
  async function download() {
    setProblem("");
    setFetching(true);
    try { await fetchVoice(); setSize(await storedVoice()); }
    catch (error) { setProblem(error instanceof Error ? error.message : "Couldn't download. Try again."); }
    finally { setFetching(false); }
  }

  return (
    <>
      <Field orientation="horizontal" className="flex-col items-stretch sm:flex-row sm:items-center">
        <FieldLabel>Read-aloud voice</FieldLabel>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto sm:justify-end">
          <Pick label="Read-aloud voice" items={speakers} value={selected} disabled={playing} onChange={setSpeaker} />
          <Button variant="outline" size="sm" disabled={playing && id !== "preview"} onClick={() => playing ? stop("preview") : void speak("preview", "Hello. This is your voice in Locus.")}>{playing && id === "preview" ? loading ? "Cancel" : "Stop" : "Test"}</Button>
          <Button variant="ghost" size="sm" disabled={!total || playing} onClick={unloadVoice}>Unload{total ? ` ${(total / 1e6).toFixed(1)} MB` : ""}</Button>
        </div>
      </Field>
      <Field orientation="horizontal" className="flex-wrap">
        <FieldLabel>Playback speed</FieldLabel>
        <Slider className="ml-auto data-[orientation=horizontal]:w-28 sm:data-[orientation=horizontal]:w-40" aria-label="Playback speed" min={0.75} max={1.5} step={0.05} value={speed} disabled={playing} onValueChange={(value) => setRate(String(value))} />
        <span className="w-12 text-right text-sm tabular-nums">{speed.toFixed(2)}×</span>
      </Field>
      <Field orientation="horizontal">
        <div className="min-w-0 flex-1">
          <FieldLabel>Dictation model</FieldLabel>
          <p className="mt-1 text-xs text-muted-foreground">Moonshine Tiny · 34.1 MB</p>
        </div>
        {size ? (
          <Button variant="ghost" size="sm" disabled={dictating} onClick={() => void clear()}>Delete</Button>
        ) : (
          <Button variant="outline" size="sm" disabled={fetching || dictating || size === null} onClick={() => void download()}>{fetching ? "Downloading…" : "Download"}</Button>
        )}
      </Field>
      {(problem || (id === "preview" && error)) && <p role="alert" className="text-sm text-destructive">{problem || error}</p>}
    </>
  );
}
