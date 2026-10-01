import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CompactCard({
  title,
  children,
  accent,
}: {
  title: string;
  children: ReactNode;
  accent?: string;
}) {
  return (
    <Card className={accent ? `border-l-4 ${accent}` : undefined}>
      <CardHeader className="py-2.5 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-0 text-sm">{children}</CardContent>
    </Card>
  );
}

export function Field({
  label,
  value,
  highlight,
  hideEmpty,
}: {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  hideEmpty?: boolean;
}) {
  const empty = value === null || value === undefined || value === "" || value === "—";
  if (hideEmpty && empty) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={"text-right tabular-nums min-w-0 " + (highlight ? "font-bold text-foreground" : "font-medium")}>
        {empty ? <span className="text-muted-foreground font-normal">—</span> : value}
      </span>
    </div>
  );
}
