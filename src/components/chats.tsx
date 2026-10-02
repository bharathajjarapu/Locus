import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon, PencilEdit01Icon, Search01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
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
  onDelete: (id: string) => void;
};

export function Chats({ chats, active, onSelect, onNew, onSearch, onSettings, onRename, onDelete }: Props) {
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
      <SidebarMenuButton onClick={close(action)}>
        <HugeiconsIcon icon={icon} /> {label}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-auto text-lg font-semibold" onClick={close(onNew)}>
              Locus
            </SidebarMenuButton>
          </SidebarMenuItem>
          {link(Add01Icon, "New chat", onNew)}
          {link(Search01Icon, "Search", onSearch)}
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarMenu>
            {chats.map((chat) => (
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
                    <SidebarMenuButton isActive={chat.id === active} className="pr-12" onClick={close(() => onSelect(chat.id))}>
                      <span>{chat.name}</span>
                    </SidebarMenuButton>
                    <SidebarMenuAction aria-label="Rename" className="right-7" onClick={() => setEditing(chat.id)}>
                      <HugeiconsIcon icon={PencilEdit01Icon} />
                    </SidebarMenuAction>
                    <SidebarMenuAction aria-label="Delete" className="hover:text-destructive" onClick={() => onDelete(chat.id)}>
                      <HugeiconsIcon icon={Delete02Icon} />
                    </SidebarMenuAction>
                  </>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>{link(Settings02Icon, "Settings", onSettings)}</SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
