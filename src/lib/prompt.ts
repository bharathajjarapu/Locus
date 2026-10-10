import type { Message, Source } from "@/lib/store";

export const personaKey = "persona";

// Answer styles picked in Persona; each saves its value and sends its text to the model
export const tones = [
  { value: "neutral", label: "Neutral", text: "" },
  { value: "friendly", label: "Friendly", text: "Be warm and encouraging." },
  { value: "professional", label: "Professional", text: "Be formal and precise." },
  { value: "casual", label: "Casual", text: "Be relaxed and conversational, like a friend." },
];
export const lengths = [
  { value: "brief", label: "Brief", text: "Answer clearly and concisely." },
  { value: "balanced", label: "Balanced", text: "Give the direct answer first, then the key details and reasoning." },
  { value: "detailed", label: "Detailed", text: "Give the direct answer first, then explain thoroughly with details, examples and caveats." },
];

export const skillsKey = "skills";
export type Skill = { name: string; text: string };
const starters: Skill[] = [
  { name: "summarize", text: "Summarize the following in three short bullet points." },
  { name: "explain", text: "Explain the following simply, with one example." },
  { name: "translate", text: "Translate the following to English." },
  { name: "fix", text: "Fix the grammar and spelling of the following, keeping its meaning." },
];

// Prompt templates saved in Persona, starting with a few examples
export const skills = (): Skill[] => JSON.parse(localStorage.getItem(skillsKey) ?? "null") ?? starters;

// Turns "/name rest" into the saved template followed by the rest
function expand(content: string) {
  const [, name, rest] = content.match(/^\/(\S+)\s*([\s\S]*)/) ?? [];
  const skill = name && skills().find((item) => item.name === name);
  return skill ? `${skill.text}${rest ? `\n\n${rest}` : ""}` : content;
}

// Builds the system prompt, adding the persona the user saved in settings and remembered facts
export function system(name: string, facts: string[] = []) {
  const persona = localStorage.getItem(personaKey)?.trim();
  const about = localStorage.getItem("about")?.trim();
  const tone = tones.find((item) => item.value === localStorage.getItem("tone"))?.text ?? "";
  const length = (lengths.find((item) => item.value === localStorage.getItem("length")) ?? lengths[1]).text;
  return `You are Locus, a helpful assistant running privately in the user's browser. ${length} Use Markdown when it helps, $...$ for inline math and $$...$$ for display math. Cite document claims with the exact [source](locus:...) links supplied with passages; never invent a source link. To make a web page, app, game, chart or drawing, write one complete \`\`\`html block with inline CSS and JavaScript; the user can preview it live.${name ? ` The user's name is ${name}.` : ""}${tone ? ` ${tone}` : ""} Current date: ${new Date().toDateString()}.${about ? `\nAbout the user: ${about}` : ""}${persona ? `\n${persona}` : ""}${facts.length ? `\nFacts the user told you in earlier chats, about the user, not you:\n${facts.map((fact) => `- ${fact}`).join("\n")}` : ""}`;
}

// A cited passage as the model sees it
export const passage = (source: Source) => `[${source.name}${source.page ? `, page ${source.page}` : ""}](locus:${source.id})\n${source.text}`;

// A message as the model sees it: attached text comes first, then what the user wrote
export const withFiles = ({ role, content, files }: Message) =>
  [...(files ?? []).map((file) => (file.image ? `Attached image "${file.name}".` : file.sources?.length ? file.sources.map(passage).join("\n\n") : file.text ? `Attached file "${file.name}":\n${file.text}` : `Attached file "${file.name}" is saved in the library; search it with search_library.`)), role === "user" ? expand(content) : content].join("\n\n");
