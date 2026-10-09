// Run with: bun src/components/model.test.tsx
import { renderToStaticMarkup } from "react-dom/server";
import { Slider } from "./ui/slider";
import { Button } from "./ui/button";
import { InputGroupButton } from "./ui/group";

for (const value of [1, [0.75, 1.5]]) {
  const html = renderToStaticMarkup(<Slider value={value} aria-label="Playback speed" />);
  const count = html.match(/data-slot="slider-thumb"/g)?.length;
  if (count !== (Array.isArray(value) ? 2 : 1)) throw new Error("Slider rendered the wrong number of thumbs");
  if (!html.includes('aria-label="Playback speed"')) throw new Error("Slider lost its label");
}
const button = renderToStaticMarkup(<Button variant="destructive" size="sm" className="h-10 bg-red-500" disabled aria-label="Delete">Delete</Button>);
if (!button.includes("h-10") || button.includes(" h-7 ") || !button.includes("bg-red-500") || button.includes(" bg-destructive/10 ")) throw new Error("Custom button styles did not override defaults");
if (!button.includes('aria-label="Delete"') || !button.includes("disabled=")) throw new Error("Button lost its accessible or disabled state");
const group = renderToStaticMarkup(<InputGroupButton size="icon-sm" aria-label="Send" />);
if (!group.includes("size-8") || group.includes(" h-8 ") || !group.includes('aria-label="Send"')) throw new Error("Input group button lost its size or label");
console.log("model controls ok");
