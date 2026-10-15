import { General } from "@/components/general";
import { Library } from "@/components/library";
import { Model } from "@/components/model";
import { Persona } from "@/components/persona";
import { Skills } from "@/components/skills";
import { Tools } from "@/components/tools";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
} & Parameters<typeof General>[0];

// Settings panels share a compact dialog with responsive tab navigation.
export function Settings({ open, setOpen, ...props }: Props) {
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
      <DialogContent className="flex h-[35rem] max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Settings</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general" className="min-h-0 flex-1 gap-4">
          <TabsList className="grid h-auto! w-full shrink-0 grid-cols-3 sm:grid-cols-6">
            {panels.map((panel) => (
              <TabsTrigger key={panel.value} value={panel.value}>{panel.label}</TabsTrigger>
            ))}
          </TabsList>
          {panels.map((panel) => (
            <TabsContent key={panel.value} value={panel.value}>{panel.view}</TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
