import { useEffect, useState } from "react";
import { Chat } from "@/components/chat";
import { Chats } from "@/components/chats";
import { Onboard } from "@/components/onboard";
import { Search } from "@/components/search";
import { Settings } from "@/components/settings";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { load } from "@/lib/llm";
import { getChats, getMessages, removeChat, saveChats, saveMessages, uid, type Message } from "@/lib/store";

// Reads a localStorage flag
const flag = (key: string) => localStorage.getItem(key) === "true";

export default function App() {
  const [onboarded, setOnboarded] = useState(() => flag("onboardingComplete"));
  const [chats, setChats] = useState(getChats);
  const [active, setActive] = useState(() => localStorage.getItem("activeChatId") ?? "");
  const [name, setName] = useState(() => localStorage.getItem("profileName") ?? "");
  const [nerd, setNerd] = useState(() => flag("nerdMode"));
  const [search, setSearch] = useState(false);
  const [settings, setSettings] = useState(false);
  const chat = chats.find((item) => item.id === active) ?? chats[0];

  useEffect(() => saveChats(chats), [chats]);
  useEffect(() => localStorage.setItem("activeChatId", chat.id), [chat.id]);
  useEffect(() => localStorage.setItem("profileName", name), [name]);
  useEffect(() => localStorage.setItem("nerdMode", String(nerd)), [nerd]);
  useEffect(() => {
    if (onboarded) void load().catch(() => {});
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
          localStorage.setItem("onboardingComplete", "true");
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
