import { Button } from "@/components/ui/button";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { resolveAgenziaContatto } from "@/lib/compagniaDisplay";

type AgenziaLike = {
  telefono?: string | null;
  cellulare?: string | null;
  mail?: string | null;
  mail_ec?: string | null;
  pec?: string | null;
} | null | undefined;

interface Props {
  agenzia?: AgenziaLike;
  className?: string;
}

function copyValue(value: string) {
  navigator.clipboard.writeText(value);
  toast.success("Copiato");
}

function ContactItem({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        title={`Copia ${label.toLowerCase()}`}
        onClick={() => copyValue(value)}
      >
        <ClipboardCopy className="h-3 w-3" />
      </Button>
    </span>
  );
}

/** Contatti agenzia di riferimento (telefono + email) con copy-to-clipboard. */
export default function AgenziaContattoInline({ agenzia, className }: Props) {
  const { telefono, email } = resolveAgenziaContatto(agenzia);

  if (!telefono && !email) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className ?? ""}`}>
      {telefono ? <ContactItem label="Tel." value={telefono} /> : null}
      {email ? <ContactItem label="Email" value={email} /> : null}
    </div>
  );
}
