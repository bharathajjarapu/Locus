import { useEffect, useState } from "react";

// State kept in localStorage as plain text; the fallback decides string or boolean
export function useSaved<T extends string | boolean>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return (typeof fallback === "boolean" ? raw === "true" : raw) as T;
  });
  useEffect(() => localStorage.setItem(key, String(value)), [key, value]);
  return [value, setValue] as const;
}
