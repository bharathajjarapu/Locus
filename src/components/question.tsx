import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAsk } from "@/lib/tools";

// Shows the model's question with its options and a free answer box; closing skips it
export function Question() {
  const { ask } = useAsk();
  const [text, setText] = useState("");
  if (!ask) return null;
  const send = (value: string) => {
    setText("");
    ask.answer(value.trim());
  };
  return (
    <Dialog open onOpenChange={(open) => !open && send("")}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="pr-6">{ask.question}</DialogTitle>
        </DialogHeader>
        {ask.options.length > 0 && (
          <div className="grid gap-2">
            {ask.options.map((option) => (
              <Button key={option} variant="outline" className="h-auto justify-start py-2 text-left whitespace-normal" onClick={() => send(option)}>
                {option}
              </Button>
            ))}
          </div>
        )}
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (text.trim()) send(text); }}>
          <Input autoFocus value={text} placeholder={ask.options.length ? "Other…" : "Your answer"} onChange={(event) => setText(event.target.value)} />
          <Button type="submit" disabled={!text.trim()}>Send</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
