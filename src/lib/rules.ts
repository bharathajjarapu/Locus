import { atom } from "@/lib/atom";

export type Rule = "ask" | "allow" | "deny";

const key = "toolRules";
const store = atom<Record<string, Rule>>(JSON.parse(localStorage.getItem(key) ?? "{}"));
export const useRules = store.use;

// How a tool is handled; it asks first until told otherwise, except asking the user
export const rule = (name: string): Rule => store.get()[name] ?? (name === "ask_user" ? "allow" : "ask");

// Saves how a tool is handled
export function setRule(name: string, value: Rule) {
  store.set({ [name]: value });
  localStorage.setItem(key, JSON.stringify(store.get()));
}
