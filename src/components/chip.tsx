import { HugeiconsIcon } from "@hugeicons/react";
import { AlertCircleIcon, Cancel01Icon, File01Icon } from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/ui/spinner";
import type { Attachment } from "@/lib/attach";

// Small pill for an attached file, with its status and a remove button while it is still in the message bar
export function Chip({ name, status = "ready", error, onRemove }: { name: string; status?: Attachment["status"]; error?: string; onRemove?: () => void }) {
  return (
    <span title={error} className="inline-flex max-w-48 items-center gap-1.5 rounded-md border bg-muted/50 py-0.5 pr-1 pl-1.5 text-sm">
      {status === "reading" || status === "indexing" ? <Spinner className="size-3.5" /> : <HugeiconsIcon icon={status === "failed" ? AlertCircleIcon : File01Icon} className={status === "failed" ? "size-3.5 text-destructive" : "size-3.5"} />}
      <span className="truncate">{name}</span>
      {status === "indexing" && <span className="text-muted-foreground">indexing</span>}
      {onRemove && (
        <button type="button" aria-label={`Remove ${name}`} className="rounded p-0.5 hover:bg-muted" onClick={onRemove}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
        </button>
      )}
    </span>
  );
}
