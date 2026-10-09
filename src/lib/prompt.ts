import type { Message } from "@/lib/store";

export const personaKey = "persona";

// Builds the system prompt, adding the persona the user saved in settings and remembered facts
export function system(name: string, facts: string[] = []) {
  const persona = localStorage.getItem(personaKey)?.trim();
  return `You are Locus, a helpful assistant running privately in the user's browser. Answer clearly and concisely. Use Markdown when it helps, $...$ for inline math and $$...$$ for display math. Cite document claims with the exact [source](locus:...) links supplied with passages; never invent a source link. To make a web page, app, game, chart or drawing, write one complete \`\`\`html block with inline CSS and JavaScript; the user can preview it live.${name ? ` The user's name is ${name}.` : ""} Current date: ${new Date().toDateString()}.${persona ? `\n${persona}` : ""}${facts.length ? `\nFacts the user told you in earlier chats, about the user, not you:\n${facts.map((fact) => `- ${fact}`).join("\n")}` : ""}`;
}

// A message as the model sees it: attached text comes first, then what the user wrote
export const withFiles = ({ content, files }: Message) =>
  [...(files ?? []).map((file) => (file.image ? `Attached image "${file.name}".` : file.sources?.length ? file.sources.map((source) => `[${source.name}${source.page ? `, page ${source.page}` : ""}](locus:${source.id})\n${source.text}`).join("\n\n") : file.text ? `Attached file "${file.name}":\n${file.text}` : `Attached file "${file.name}" is saved in the library; search it with search_library.`)), content].join("\n\n");
