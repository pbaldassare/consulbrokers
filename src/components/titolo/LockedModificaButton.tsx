import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  disabled: boolean;
  lockedTitle?: string;
  onClick: () => void;
  variant?: "ghost" | "outline";
  className?: string;
  children?: ReactNode;
}

/**
 * Modifica della scheda titolo. Se locked (es. incasso già fatto) il Button è
 * disabled (pointer-events-none): il tooltip vive sul wrapper per restare visibile in hover.
 */
export function LockedModificaButton({
  disabled,
  lockedTitle,
  onClick,
  variant = "ghost",
  className,
  children = "Modifica",
}: Props) {
  const btn = (
    <Button type="button" variant={variant} size="sm" onClick={onClick} disabled={disabled} className={className}>
      <Pencil className="w-4 h-4 mr-1" /> {children}
    </Button>
  );

  if (!disabled || !lockedTitle) return btn;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={0} aria-label={lockedTitle}>
          {btn}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {lockedTitle}
      </TooltipContent>
    </Tooltip>
  );
}
