import type { Message } from "@/lib/store";

export const personaKey = "persona";

// Builds the system prompt, adding the persona the user saved in settings
export function system(name: string) {
  const persona = localStorage.getItem(personaKey)?.trim();
  return `You are Locus, a helpful assistant running privately in the user's browser. Answer clearly and concisely. Use Markdown when it helps, $...$ for inline math and $$...$$ for display math.${name ? ` The user's name is ${name}.` : ""} Current date: ${new Date().toDateString()}.${persona ? `\n${persona}` : ""}`;
}

// A message as the model sees it: attached text comes first, then what the user wrote
export const withFiles = ({ content, files }: Message) =>
  [...(files ?? []).map((file) => (file.image ? `Attached image "${file.name}".` : file.text ? `Attached file "${file.name}":\n${file.text}` : `Attached file "${file.name}" is saved in the library; search it with search_library.`)), content].join("\n\n");
