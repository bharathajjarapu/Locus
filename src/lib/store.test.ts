// Run with: bun src/lib/store.test.ts
import { title, trim, type Message } from "./store";

// Throws when two values differ
const equal = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
};
const message = (content: string): Message => ({ id: content, role: "user", content });

equal(trim([message("aaaa"), message("bb"), message("cc")], 4).map((m) => m.id), ["bb", "cc"]);
equal(trim([message("toolong")], 3).map((m) => m.id), ["toolong"]);
equal(trim([]), []);
equal(title("what is the weather?"), "What is the weather");
equal(title("???"), "Chat");
console.log("store ok");
