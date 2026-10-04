import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { atom } from "@/lib/atom";
import { download } from "@/lib/utils";

const store = atom({ code: "" });

// Opens HTML or SVG from a reply in the viewer
export const show = (code: string) => store.set({ code });

// Live preview of a page the model wrote; the sandbox keeps it away from the app's chats and keys
export function Artifact() {
  const { code } = store.use();
  const [view, setView] = useState("preview");
  return (
    <Dialog open={!!code} onOpenChange={(open) => !open && show("")}>
      <DialogContent className="flex h-[90dvh] flex-col sm:max-w-5xl">
        <DialogHeader className="flex-row items-center gap-2 pr-8">
          <DialogTitle className="flex-1">Artifact</DialogTitle>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => download("artifact.html", code, "text/html")}>
            Download
          </Button>
        </DialogHeader>
        {view === "preview" ? (
          <iframe title="Artifact" sandbox="allow-scripts allow-forms allow-modals" srcDoc={code} className="min-h-0 flex-1 rounded-lg border bg-white" />
        ) : (
          <pre className="min-h-0 flex-1 overflow-auto rounded-lg bg-muted p-3 text-xs">{code}</pre>
        )}
      </DialogContent>
    </Dialog>
  );
}
