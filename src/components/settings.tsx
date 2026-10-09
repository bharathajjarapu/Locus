import { Embeddings } from "@/components/embeddings";
import { General } from "@/components/general";
import { Model } from "@/components/model";
import { Persona } from "@/components/persona";
import { Tools } from "@/components/tools";
import { Voice } from "@/components/voice";
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
            <TabsTrigger value="model">Models</TabsTrigger>
            <TabsTrigger value="voice">Voice</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
            <TabsTrigger value="persona">Persona</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="min-h-0 overflow-y-auto pt-2">
            <General {...props} />
          </TabsContent>
          <TabsContent value="model" className="min-h-0 overflow-y-auto pt-2">
            <Model />
          </TabsContent>
          <TabsContent value="voice" className="min-h-0 overflow-y-auto pt-2">
            <Voice />
          </TabsContent>
          <TabsContent value="tools" className="min-h-0 overflow-y-auto pt-2">
            <Tools />
          </TabsContent>
          <TabsContent value="embeddings" className="min-h-0 overflow-y-auto pt-2">
            <Embeddings />
          </TabsContent>
          <TabsContent value="persona" className="min-h-0 overflow-y-auto pt-2">
            <Persona />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
