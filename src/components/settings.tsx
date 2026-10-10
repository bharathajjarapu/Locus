import { General } from "@/components/general";
import { Library } from "@/components/library";
import { Model } from "@/components/model";
import { Persona } from "@/components/persona";
import { Skills } from "@/components/skills";
import { Tools } from "@/components/tools";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
} & Parameters<typeof General>[0];

// Settings panels share a compact dialog with responsive tab navigation.
export function Settings({ open, setOpen, ...props }: Props) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[35rem] max-h-[90dvh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Preferences are saved on this device.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="general" className="min-h-0 flex-1">
          <TabsList className="grid h-auto! w-full shrink-0 grid-cols-3 sm:grid-cols-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="persona">Persona</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="model">Models</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="no-scrollbar min-h-0 overflow-y-auto pt-2">
            <General {...props} />
          </TabsContent>
          <TabsContent value="persona" className="no-scrollbar min-h-0 overflow-y-auto pt-2">
            <Persona />
          </TabsContent>
          <TabsContent value="skills" className="no-scrollbar min-h-0 overflow-y-auto pt-2">
            <Skills />
          </TabsContent>
          <TabsContent value="model" className="no-scrollbar min-h-0 overflow-y-auto pt-2">
            <Model />
          </TabsContent>
          <TabsContent value="tools" className="no-scrollbar min-h-0 overflow-y-auto pt-2">
            <Tools />
          </TabsContent>
          <TabsContent value="files" className="no-scrollbar min-h-0 overflow-y-auto pt-2">
            <Library />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
