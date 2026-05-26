import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Toggle ciclico tema: Light → Dark → System.
 * Da montare nella Topbar.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const label =
    theme === "dark" ? "Tema scuro" : theme === "light" ? "Tema chiaro" : "Tema di sistema";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={`Cambia tema (attuale: ${label})`}
            className="print:hidden"
          >
            <Icon className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label} — clicca per cambiare</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ThemeToggle;
