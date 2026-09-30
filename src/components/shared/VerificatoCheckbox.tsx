import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useId } from "react";

interface Props {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

/** Checkbox «Verificato» per le finestre di caricamento con un solo documento. */
export function VerificatoCheckbox({ checked, onCheckedChange, disabled, className }: Props) {
  const id = useId();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onCheckedChange(c === true)} disabled={disabled} />
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
        Verificato
      </Label>
    </div>
  );
}
