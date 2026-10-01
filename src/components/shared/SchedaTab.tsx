import type { ComponentProps } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type SchedaTabProps = ComponentProps<typeof TabsContent> & { readOnly?: boolean };

/** Scheda di un form a tab: in sola lettura disabilita i campi lasciando cliccabili le linguette. */
const SchedaTab = ({ readOnly = false, className, children, ...props }: SchedaTabProps) => (
  <TabsContent {...props} className="mt-3">
    <fieldset disabled={readOnly} className={cn("min-w-0 space-y-3", className)}>
      {children}
    </fieldset>
  </TabsContent>
);

export default SchedaTab;
