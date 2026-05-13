import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { validatePIVA } from "@/lib/validatePIVA";
import { validateCF } from "@/lib/validateCF";

export type FiscalKind = "cf16" | "piva" | "cf-azienda";

interface FiscalCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  kind: FiscalKind;
  required?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  /** Notifica al parent se il valore corrente è valido (post normalizzazione). */
  onValidChange?: (valid: boolean) => void;
}

function runValidation(kind: FiscalKind, value: string) {
  const v = (value || "").trim();
  if (!v) return { valid: false as const, error: undefined as string | undefined };
  if (kind === "piva") return validatePIVA(v);
  if (kind === "cf16") return validateCF(v, { allowPIVAFormat: false });
  return validateCF(v, { allowPIVAFormat: true });
}

const HINTS: Record<FiscalKind, string> = {
  piva: "11 cifre numeriche con checksum",
  cf16: "16 caratteri (lettere + cifre) con carattere di controllo",
  "cf-azienda": "16 caratteri o 11 cifre (P.IVA)",
};

export function FiscalCodeInput({
  value,
  onChange,
  kind,
  required,
  placeholder,
  className,
  id,
  disabled,
  onValidChange,
}: FiscalCodeInputProps) {
  const [touched, setTouched] = React.useState(false);
  const maxLength = kind === "piva" ? 11 : 16;

  const result = React.useMemo(() => runValidation(kind, value), [kind, value]);

  React.useEffect(() => {
    onValidChange?.(result.valid);
  }, [result.valid, onValidChange]);

  const showError = touched && !!value && !result.valid;
  const showRequiredEmpty = required && !value;

  return (
    <div className="space-y-1">
      <Input
        id={id}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        title={HINTS[kind]}
        maxLength={maxLength}
        onChange={(e) => {
          let v = e.target.value.toUpperCase().replace(/\s+/g, "");
          if (kind === "piva") v = v.replace(/\D/g, "");
          onChange(v);
        }}
        onBlur={() => setTouched(true)}
        className={cn(
          showError && "border-destructive focus-visible:ring-destructive",
          !showError && showRequiredEmpty && "border-amber-400",
          className,
        )}
      />
      {showError && (
        <p className="text-xs text-destructive">{result.error}</p>
      )}
    </div>
  );
}
