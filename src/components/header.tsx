import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, GhostIcon, Moon02Icon, Share08Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { Pick } from "@/components/pick";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSaved } from "@/lib/saved";

type Props = {
  title: string;
  incognito: boolean;
  setIncognito: (value: boolean) => void;
  empty: boolean;
  onNew: () => void;
  onShare: (format: string) => void;
};

const formats = [
  { value: "md", label: "Markdown" },
  { value: "html", label: "HTML page" },
];

// Top bar floating over the chat
export function Header({ title, incognito, setIncognito, empty, onNew, onShare }: Props) {
  const [dark, setDark] = useSaved<boolean>("darkMode", true);

  // Switches theme with a crossfade where supported
  function toggle() {
    const apply = () => document.documentElement.classList.toggle("dark", !dark);
    if (document.startViewTransition) document.startViewTransition(apply);
    else apply();
    setDark(!dark);
  }

  return (
    <header className="absolute inset-x-0 top-0 z-10 flex h-16 items-center gap-3 bg-background/90 px-3 backdrop-blur-xl sm:px-5">
      <div className="flex items-center gap-1">
        <SidebarTrigger />
        <Button variant="ghost" size="icon-sm" aria-label="New chat" onClick={onNew}>
          <HugeiconsIcon icon={Add01Icon} />
        </Button>
      </div>
      <span className="min-w-0 truncate text-sm font-medium">{title}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {empty ? (
          <Button variant={incognito ? "secondary" : "ghost"} size="icon-lg" aria-label="Incognito" aria-pressed={incognito} title={incognito ? "Turn off incognito" : "Start an incognito chat"} onClick={() => setIncognito(!incognito)}>
            <HugeiconsIcon icon={GhostIcon} />
          </Button>
        ) : (
          <Pick label="Share chat" compact items={formats} value="" onChange={onShare}>
            <HugeiconsIcon icon={Share08Icon} />
          </Pick>
        )}
        <Button variant="ghost" size="icon-lg" aria-label={dark ? "Light mode" : "Dark mode"} onClick={toggle}>
          <HugeiconsIcon icon={dark ? Sun03Icon : Moon02Icon} />
        </Button>
      </div>
    </header>
  );
}
