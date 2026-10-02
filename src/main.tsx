import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/styles/global.css";

document.documentElement.classList.toggle("dark", localStorage.getItem("darkMode") !== "false");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
