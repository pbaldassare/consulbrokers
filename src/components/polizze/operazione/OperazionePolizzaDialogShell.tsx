import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  eventColumn: ReactNode;
  editorColumn: ReactNode;
  footer: ReactNode;
}

/** Layout monocolonna come Appendice / Estinzione: evento sopra, editor premi sotto. */
export function OperazionePolizzaDialogShell({
  open,
  onOpenChange,
  title,
  description,
  eventColumn,
  editorColumn,
  footer,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description != null && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-6 py-2">
          {eventColumn}

          <div className="border-t pt-4">{editorColumn}</div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
