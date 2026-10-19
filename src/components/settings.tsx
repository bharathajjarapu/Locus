import { useState } from "react";
import { General } from "@/components/general";
import { Library } from "@/components/library";
import { Model } from "@/components/model";
import { Persona } from "@/components/persona";
import { Skills } from "@/components/skills";
import { Tools } from "@/components/tools";
import { Pick } from "@/components/pick";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
} & Parameters<typeof General>[0];

// Keeps settings in a sidebar on desktop and a section picker on mobile.
export function Settings({ open, setOpen, ...props }: Props) {
  const [section, setSection] = useState("general");
  const panels = [
    { value: "general", label: "General", view: <General {...props} /> },
    { value: "persona", label: "Persona", view: <Persona /> },
    { value: "skills", label: "Skills", view: <Skills /> },
    { value: "model", label: "Models", view: <Model /> },
    { value: "tools", label: "Tools", view: <Tools /> },
    { value: "files", label: "Files", view: <Library /> },
  ];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[36rem] max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-5 py-4">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="shrink-0 border-b px-5 py-3 sm:hidden">
          <Pick label="Settings section" items={panels} value={section} onChange={setSection} />
        </div>
        <Tabs value={section} onValueChange={setSection} orientation="vertical" className="min-h-0 flex-1 gap-0">
          <TabsList aria-label="Settings sections" className="hidden h-full! w-40 shrink-0 justify-start gap-1 rounded-none border-r bg-muted/35 p-3 sm:flex">
            {panels.map((panel) => (
              <TabsTrigger key={panel.value} value={panel.value} className="h-9 flex-none px-3 data-active:shadow-none">{panel.label}</TabsTrigger>
            ))}
          </TabsList>
          {panels.map((panel) => (
            <TabsContent key={panel.value} value={panel.value} className="overscroll-contain px-5 py-5 sm:px-6">
              <h2 className="mb-5 text-lg font-semibold tracking-tight">{panel.label}</h2>
              {panel.view}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
