import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Chat } from "@/lib/store";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  chats: Chat[];
  onSelect: (id: string) => void;
};

export function Search({ open, setOpen, chats, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const found = chats.filter((chat) => chat.name.toLowerCase().includes(query.trim().toLowerCase()));

  // Opens a chat and closes the dialog
  const pick = (id: string) => {
    onSelect(id);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (setOpen(next), setQuery(""))}>
      <DialogContent showCloseButton={false} className="gap-2 p-2">
        <DialogTitle className="sr-only">Search chats</DialogTitle>
        <Input autoFocus placeholder="Search chats…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && found[0] && pick(found[0].id)} />
        <div className="max-h-72 overflow-y-auto">
          {found.map((chat) => (
            <Button key={chat.id} variant="ghost" className="w-full justify-start" onClick={() => pick(chat.id)}>
              {chat.name}
            </Button>
          ))}
          {!found.length && <p className="p-2 text-sm text-muted-foreground">No chats match.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
