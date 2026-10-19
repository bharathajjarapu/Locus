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
      <DialogContent className="gap-4 p-5">
        <DialogTitle className="pr-8 text-base font-semibold">Search chats</DialogTitle>
        <Input autoFocus aria-label="Search by chat name" placeholder="Search by name…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && found[0] && pick(found[0].id)} />
        <div className="max-h-[min(24rem,55dvh)] space-y-1 overflow-y-auto overscroll-contain">
          {found.map((chat) => (
            <Button key={chat.id} variant="ghost" className="h-10 w-full justify-start px-3 text-left" onClick={() => pick(chat.id)}>
              <span className="truncate">{chat.name}</span>
            </Button>
          ))}
          {!found.length && <div className="px-3 py-8 text-center text-sm"><p>No chats found</p><p className="mt-1 text-muted-foreground">Try a different name.</p></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
