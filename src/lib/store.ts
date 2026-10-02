export type Chat = { id: string; name: string };
export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  speed?: number;
  tokens?: number;
};
type Backup = { chatTabs: Chat[]; chats: Record<string, { messages: Message[] }> };

// Reads JSON from localStorage, falling back on missing or broken data
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") ?? fallback;
  } catch {
    return fallback;
  }
}

// Creates a short unique id
export const uid = () => crypto.randomUUID().slice(0, 8);

// Returns the saved chat list, never empty
export function getChats(): Chat[] {
  const chats = read<Chat[]>("chatTabs", []);
  return chats.length ? chats : [{ id: uid(), name: "Chat" }];
}

export const saveChats = (chats: Chat[]) =>
  localStorage.setItem("chatTabs", JSON.stringify(chats));

// Returns a chat's messages, upgrading the older stored shape
export function getMessages(id: string): Message[] {
  return read<{ role: string }[]>(`chat_${id}`, [])
    .filter((message) => message.role !== "system")
    .map((message) => ({
      ...message,
      role: message.role === "user" ? "user" : "assistant",
    })) as Message[];
}

export const saveMessages = (id: string, messages: Message[]) =>
  localStorage.setItem(`chat_${id}`, JSON.stringify(messages));

export function removeChat(id: string) {
  localStorage.removeItem(`chat_${id}`);
  localStorage.removeItem(`chat_meta_${id}`);
}

// Bundles every chat into a downloadable backup
export function exportAll(chats: Chat[]): Backup {
  return {
    chatTabs: chats,
    chats: Object.fromEntries(
      chats.map((chat) => [chat.id, { messages: getMessages(chat.id) }]),
    ),
  };
}

// Restores chats from a backup and returns the restored list
export function importAll(backup: Backup): Chat[] {
  if (!Array.isArray(backup.chatTabs) || !backup.chatTabs.length) throw new Error("Invalid backup");
  for (const chat of backup.chatTabs) {
    saveMessages(chat.id, backup.chats?.[chat.id]?.messages ?? []);
  }
  saveChats(backup.chatTabs);
  return backup.chatTabs;
}

// Keeps the newest messages that fit the prompt budget
export function trim(messages: Message[], budget = 16_000) {
  let size = 0;
  let start = messages.length;
  while (start > 0 && size + messages[start - 1].content.length <= budget) {
    size += messages[--start].content.length;
  }
  return messages.slice(Math.min(start, messages.length - 1));
}

// Titles a chat from the first five words of a message, until the model names it
export function title(text: string) {
  const words = text.match(/[\p{L}\p{N}']+/gu) ?? [];
  const start = words.slice(0, 5).join(" ").slice(0, 40);
  return start ? start[0].toUpperCase() + start.slice(1) : "Chat";
}

// Greets by time of day
export function greet(name: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : hour < 21 ? "Evening" : "Night";
  const first = name.split(" ")[0];
  return `${hour < 5 ? "Up Late" : `Good ${part}`}${first ? ` ${first}` : ""}`;
}
