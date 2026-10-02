import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, GhostIcon, Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useSaved } from "@/lib/saved";

type Props = {
  incognito: boolean;
  setIncognito: (value: boolean) => void;
  empty: boolean;
  onNew: () => void;
};

// Top bar floating over the chat
export function Header({ incognito, setIncognito, empty, onNew }: Props) {
  const [dark, setDark] = useSaved<boolean>("darkMode", true);

  // Switches theme with a crossfade where supported
  function toggle() {
    const apply = () => document.documentElement.classList.toggle("dark", !dark);
    if (document.startViewTransition) document.startViewTransition(apply);
    else apply();
    setDark(!dark);
  }

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-14 items-center gap-2 px-4 *:pointer-events-auto">
      <div className="flex items-center gap-1">
        <SidebarTrigger />
        <Button variant="ghost" size="icon-sm" aria-label="New chat" onClick={onNew}>
          <HugeiconsIcon icon={Add01Icon} />
        </Button>
      </div>
      <div className="ml-auto flex items-center gap-1">
        {empty && (
          <Button variant={incognito ? "secondary" : "ghost"} size="icon-lg" aria-label="Incognito" onClick={() => setIncognito(!incognito)}>
            <HugeiconsIcon icon={GhostIcon} />
          </Button>
        )}
        <Button variant="ghost" size="icon-lg" aria-label={dark ? "Light mode" : "Dark mode"} onClick={toggle}>
          <HugeiconsIcon icon={dark ? Sun03Icon : Moon02Icon} />
        </Button>
      </div>
    </header>
  );
}
