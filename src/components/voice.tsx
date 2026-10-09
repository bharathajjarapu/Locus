import { useEffect, useState } from "react";
import { Pick } from "@/components/pick";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { useSaved } from "@/lib/saved";
import { forgetVoice, speakers, speak, stop, storedVoice, unloadVoice, useVoice } from "@/lib/speech";

// Read-aloud preferences, a voice preview, and local voice storage controls.
export function Voice() {
  const [speaker, setSpeaker] = useSaved<string>("speaker", "heartnano");
  const [rate, setRate] = useSaved<string>("voiceRate", "1");
  const [size, setSize] = useState<number | null>(null);
  const [problem, setProblem] = useState("");
  const { playing, loading, dictating, id, error, sizes } = useVoice();
  const selected = speakers.some((item) => item.value === speaker) ? speaker : "heartnano";
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

  return (
    <FieldGroup className="gap-4">
      <Field>
        <FieldLabel>Read-aloud voice</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          <Pick label="Read-aloud voice" items={speakers} value={selected} disabled={playing} onChange={setSpeaker} />
          <Button variant="outline" size="sm" disabled={playing && id !== "preview"} onClick={() => playing ? stop("preview") : void speak("preview", "Hello. This is your voice in Locus.")}>{playing && id === "preview" ? loading ? "Cancel preview" : "Stop preview" : "Test voice"}</Button>
        </div>
        <FieldDescription>English voices. Heart nano uses the smallest download; others use about 4–7 MB.</FieldDescription>
      </Field>
      <Field>
        <div className="flex items-center justify-between">
          <FieldLabel>Playback speed</FieldLabel>
          <span className="text-sm tabular-nums">{speed.toFixed(2)}×</span>
        </div>
        <Slider aria-label="Playback speed" min={0.75} max={1.5} step={0.05} value={speed} disabled={playing} onValueChange={(value) => setRate(String(value))} />
        <FieldDescription>Changes playback speed and pitch.</FieldDescription>
      </Field>
      <Field className="border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel>Dictation · Moonshine Tiny Q8</FieldLabel>
          <Button variant="outline" size="sm" disabled={!size || dictating} onClick={() => void clear()}>Delete download</Button>
        </div>
        <FieldDescription>{size === null ? "Checking storage…" : size ? `${(size / 1e6).toFixed(1)} MB downloaded` : "34.1 MB · downloads on first use"}{dictating ? ". Stop dictation to delete its download." : ". English, local inference."}</FieldDescription>
      </Field>
      <Field>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FieldLabel>Read-aloud storage</FieldLabel>
          <Button variant="outline" size="sm" disabled={!total || playing} onClick={unloadVoice}>Unload voices</Button>
        </div>
        <FieldDescription>{total ? `${(total / 1e6).toFixed(2)} MB of voice weights in memory` : "Voices load when first played and stay in memory."}</FieldDescription>
      </Field>
      {(problem || (id === "preview" && error)) && <p role="alert" className="text-sm text-destructive">{problem || error}</p>}
    </FieldGroup>
  );
}
