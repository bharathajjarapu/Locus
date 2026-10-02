import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, MoreHorizontalIcon, Search01Icon, Settings02Icon } from "@hugeicons/core-free-icons";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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
  const { setOpenMobile } = useSidebar();

  // Saves a new name and leaves edit mode
  const rename = (id: string, name: string) => {
    if (name.trim()) onRename(id, name.trim());
    setEditing(null);
  };

  // Runs an action and closes the mobile drawer
  const close = (action: () => void) => () => {
    action();
    setOpenMobile(false);
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="text-lg font-semibold" onClick={close(onNew)}>
              Locus
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={close(onNew)}>
              <HugeiconsIcon icon={Add01Icon} /> New chat
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={close(onSearch)}>
              <HugeiconsIcon icon={Search01Icon} /> Search
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
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
                      <SidebarMenuButton isActive={chat.id === active} onClick={close(() => onSelect(chat.id))}>
                        <span>{chat.name}</span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<SidebarMenuAction showOnHover aria-label="Chat options" />}>
                          <HugeiconsIcon icon={MoreHorizontalIcon} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start">
                          <DropdownMenuItem onClick={() => setEditing(chat.id)}>Rename</DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => onDelete(chat.id)}>
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={close(onSettings)}>
              <HugeiconsIcon icon={Settings02Icon} /> Settings
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
