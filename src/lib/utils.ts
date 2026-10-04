import { twMerge, type ClassNameValue } from "tailwind-merge";

// Base UI also allows state functions as className; cn skips those like clsx did
type Input = ClassNameValue | ((state: never) => unknown);

// Joins class names and resolves Tailwind conflicts
export const cn = (...inputs: Input[]) =>
  twMerge(inputs.filter((input): input is ClassNameValue => typeof input !== "function"));

// Saves text as a file in the user's downloads
export function download(name: string, text: string, type: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}
