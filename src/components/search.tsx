import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Chat } from "@/lib/store";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
  chats: Chat[];
  onSelect: (id: string) => void;
};

export function Search({ open, setOpen, chats, onSelect }: Props) {
  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search chats" description="Find a chat by name">
      <Command>
        <CommandInput placeholder="Search chats…" />
        <CommandList>
          <CommandEmpty>No chats match.</CommandEmpty>
          <CommandGroup heading="Chats">
            {chats.map((chat) => (
              <CommandItem
                key={chat.id}
                value={`${chat.name} ${chat.id}`}
                onSelect={() => {
                  onSelect(chat.id);
                  setOpen(false);
                }}
              >
                {chat.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
