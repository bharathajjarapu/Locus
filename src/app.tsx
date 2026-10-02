import { useEffect, useState } from "react";
import { Chat } from "@/components/chat";
import { Chats } from "@/components/chats";
import { Onboard } from "@/components/onboard";
import { Search } from "@/components/search";
import { Settings } from "@/components/settings";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { preload } from "@/lib/llm";
import { useSaved } from "@/lib/saved";
import { getChats, getMessages, removeChat, saveChats, saveMessages, uid, type Message } from "@/lib/store";

export default function App() {
  const [onboarded, setOnboarded] = useSaved<boolean>("onboardingComplete", false);
  const [chats, setChats] = useState(getChats);
  const [active, setActive] = useSaved<string>("activeChatId", "");
  const [name, setName] = useSaved<string>("profileName", "");
  const [nerd, setNerd] = useSaved<boolean>("nerdMode", false);
  const [search, setSearch] = useState(false);
  const [settings, setSettings] = useState(false);
  const chat = chats.find((item) => item.id === active) ?? chats[0];

  useEffect(() => saveChats(chats), [chats]);
  useEffect(() => {
    if (onboarded) void preload();
  }, [onboarded]);

  // Adds a chat, optionally seeded with messages
  function add(name = "Chat", messages: Message[] = []) {
    const next = { id: uid(), name };
    saveMessages(next.id, messages);
    setChats((list) => [...list, next]);
    setActive(next.id);
  }

  // Starts a new chat unless the current one is still empty
  function fresh() {
    if (getMessages(chat.id).length) add();
  }

  // Deletes a chat and keeps at least one around
  function remove(id: string) {
    removeChat(id);
    const rest = chats.filter((item) => item.id !== id);
    setChats(rest.length ? rest : [{ id: uid(), name: "Chat" }]);
  }

  // Renames a chat
  const rename = (id: string, value: string) =>
    setChats((items) => items.map((item) => (item.id === id ? { ...item, name: value } : item)));

  useEffect(() => {
    // Ctrl+K opens search, Ctrl+Shift+O starts a chat
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "k") setSearch((value) => !value);
      else if (event.shiftKey && key === "o") fresh();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!onboarded) {
    return (
      <Onboard
        onDone={(value) => {
          setName(value);
          setOnboarded(true);
        }}
      />
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <Chats
        chats={chats}
        active={chat.id}
        onSelect={setActive}
        onNew={fresh}
        onSearch={() => setSearch(true)}
        onSettings={() => setSettings(true)}
        onRename={rename}
        onDelete={remove}
      />
      <SidebarInset className="h-dvh">
        <Chat
          key={chat.id}
          chat={chat}
          name={name}
          nerd={nerd}
          onTitle={(value) => rename(chat.id, value)}
          onFork={(messages) => add(`${chat.name} (Fork)`, messages)}
          onNew={fresh}
        />
      </SidebarInset>
      <Search open={search} setOpen={setSearch} chats={chats} onSelect={setActive} />
      <Settings
        open={settings}
        setOpen={setSettings}
        name={name}
        setName={setName}
        nerd={nerd}
        setNerd={setNerd}
        chats={chats}
        setChats={setChats}
      />
    </SidebarProvider>
  );
}
