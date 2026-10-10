import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAsk } from "@/lib/tools";

// Shows the model's questions, each with option buttons and an "Other" box; closing skips them
export function Question() {
  const { ask } = useAsk();
  const [picks, setPicks] = useState<string[]>([]);
  if (!ask) return null;
  const { items } = ask;
  const done = items.every((_, index) => picks[index]?.trim());
  const send = (values: string[]) => {
    setPicks([]);
    ask.answer(values.map((value) => value.trim()));
  };
  const set = (index: number, value: string) => setPicks((list) => Object.assign([...list], { [index]: value }));
  return (
    <Dialog open onOpenChange={(open) => !open && send([])}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{items.length > 1 ? "A few questions" : "A question"}</DialogTitle>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); if (done) send(picks); }}>
          {items.map(({ question, options }, index) => (
            <fieldset key={index} className="grid gap-2">
              <legend className="mb-2 font-medium">{question}</legend>
              {options.map((option) => (
                <Button key={option} type="button" variant={picks[index] === option ? "secondary" : "outline"} aria-pressed={picks[index] === option} className="h-auto justify-start py-2 text-left whitespace-normal" onClick={() => (items.length === 1 ? send([option]) : set(index, option))}>
                  {option}
                </Button>
              ))}
              <Input autoFocus={index === 0} aria-label={question} value={options.includes(picks[index]) ? "" : (picks[index] ?? "")} placeholder={options.length ? "Other…" : "Your answer"} onChange={(event) => set(index, event.target.value)} />
            </fieldset>
          ))}
          <Button type="submit" disabled={!done}>Send</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
