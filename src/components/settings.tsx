import { Embeddings } from "@/components/embeddings";
import { General } from "@/components/general";
import { Model } from "@/components/model";
import { Persona } from "@/components/persona";
import { Tools } from "@/components/tools";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  open: boolean;
  setOpen: (open: boolean) => void;
} & Parameters<typeof General>[0];

// Settings dialog: one tab each for preferences, model, tools, embeddings and persona
export function Settings({ open, setOpen, ...props }: Props) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex h-[35rem] max-h-[90dvh] flex-col overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Preferences are saved on this device.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="general">
          <TabsList className="w-full">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
            <TabsTrigger value="persona">Persona</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="pt-2">
            <General {...props} />
          </TabsContent>
          <TabsContent value="model" className="pt-2">
            <Model />
          </TabsContent>
          <TabsContent value="tools" className="pt-2">
            <Tools />
          </TabsContent>
          <TabsContent value="embeddings" className="pt-2">
            <Embeddings />
          </TabsContent>
          <TabsContent value="persona" className="pt-2">
            <Persona />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
