import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon, PencilEdit01Icon, Pin02Icon, Search01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { Chat } from "@/lib/store";

type Props = {
  chats: Chat[];
  active: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onSearch: () => void;
  onSettings: () => void;
  onRename: (id: string, name: string) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
};

export function Chats({ chats, active, onSelect, onNew, onSearch, onSettings, onRename, onPin, onDelete }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const { dismiss } = useSidebar();

  // Saves a new name and leaves edit mode
  const rename = (id: string, name: string) => {
    if (name.trim()) onRename(id, name.trim());
    setEditing(null);
  };

  // Runs an action and closes the mobile drawer
  const close = (action: () => void) => () => {
    action();
    dismiss();
  };

  // Menu row with an icon and label
  const link = (icon: typeof Add01Icon, label: string, action: () => void) => (
    <SidebarMenuItem>
      <SidebarMenuButton className="h-10" onClick={close(action)}>
        <HugeiconsIcon icon={icon} /> {label}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  // Sidebar row for one chat
  const row = (chat: Chat) => (
    <SidebarMenuItem key={chat.id}>
      {editing === chat.id ? (
        <SidebarInput
          autoFocus
          defaultValue={chat.name}
          aria-label="Chat name"
          onBlur={(event) => rename(chat.id, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") rename(chat.id, event.currentTarget.value);
            if (event.key === "Escape") setEditing(null);
          }}
        />
      ) : (
        <>
          <SidebarMenuButton isActive={chat.id === active} aria-current={chat.id === active ? "page" : undefined} title={chat.name} className="h-10 pr-[5.25rem] [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:pr-36" onClick={close(() => onSelect(chat.id))}>
            <span>{chat.name}</span>
          </SidebarMenuButton>
          <SidebarMenuAction aria-label={chat.pinned ? "Unpin" : "Pin"} aria-pressed={!!chat.pinned} title={chat.pinned ? "Unpin chat" : "Pin chat"} className="top-2 right-14 [@media(pointer:coarse)]:right-24" onClick={() => onPin(chat.id)}>
            <HugeiconsIcon icon={Pin02Icon} />
          </SidebarMenuAction>
          <SidebarMenuAction aria-label="Rename" title="Rename chat" className="top-2 right-7 [@media(pointer:coarse)]:right-12" onClick={() => setEditing(chat.id)}>
            <HugeiconsIcon icon={PencilEdit01Icon} />
          </SidebarMenuAction>
          <SidebarMenuAction aria-label="Delete" title="Delete chat" className="top-2 hover:text-destructive [@media(pointer:coarse)]:right-0" onClick={() => onDelete(chat.id)}>
            <HugeiconsIcon icon={Delete02Icon} />
          </SidebarMenuAction>
        </>
      )}
    </SidebarMenuItem>
  );

  // Sidebar group of chats under a label
  const group = (label: string, list: Chat[]) => list.length > 0 && (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>{list.map(row)}</SidebarMenu>
    </SidebarGroup>
  );

  return (
    <Sidebar>
      <SidebarHeader className="gap-4 px-3 pt-5 pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex h-9 items-center px-2 text-base font-semibold tracking-tight">Locus</div>
          </SidebarMenuItem>
          {link(Add01Icon, "New chat", onNew)}
          {link(Search01Icon, "Search chats", onSearch)}
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-1 pt-2">
        {group("Pinned", chats.filter((chat) => chat.pinned))}
        {group("Chats", chats.filter((chat) => !chat.pinned))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <SidebarMenu>{link(Settings02Icon, "Settings", onSettings)}</SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
