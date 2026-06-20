import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface InfoHintProps {
  text: string;
  className?: string;
  size?: "xs" | "sm";
  /** Se true, non avvolge in TooltipProvider (usalo quando il provider esiste già a monte) */
  inProvider?: boolean;
}

/**
 * Piccola icona "i" con tooltip esplicativo.
 * Usato nelle KPI card / header tabelle del portale cliente per spiegare
 * meglio cosa rappresenta un valore o una sezione.
 */
const InfoHint = ({ text, className, size = "sm", inProvider = false }: InfoHintProps) => {
  const iconCls =
    size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";

  const content = (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Informazioni"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "inline-flex items-center justify-center text-muted-foreground/70 hover:text-primary transition-colors align-middle",
            className
          )}
        >
          <Info className={iconCls} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  );

  if (inProvider) return content;
  return <TooltipProvider delayDuration={150}>{content}</TooltipProvider>;
};

export default InfoHint;
