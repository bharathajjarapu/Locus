import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app";
import "@/styles/global.css";

document.documentElement.classList.toggle("dark", localStorage.getItem("darkMode") !== "false");

// Text fields match :focus-visible after clicks, so track keyboard use separately.
document.addEventListener("keydown", (event) => {
  if (event.key === "Tab" && !event.defaultPrevented) document.documentElement.dataset.keyboard = "";
});
document.addEventListener("pointerdown", () => { delete document.documentElement.dataset.keyboard; }, true);

// Applies downloaded fonts without blocking the app's first paint.
const fonts = document.querySelector<HTMLLinkElement>("#fonts")!;
fonts.addEventListener("load", () => { fonts.media = "all"; }, { once: true });
if (fonts.sheet) fonts.media = "all";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
