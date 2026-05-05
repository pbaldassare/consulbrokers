import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Inbox, RefreshCw, Maximize2 } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  isError?: boolean;
  error?: any;
  isEmpty?: boolean;
  onRetry?: () => void;
  onExpand?: () => void;
  height?: number;
  className?: string;
  children: ReactNode;
}

export default function CfoChartCard({
  title,
  subtitle,
  isLoading,
  isError,
  error,
  isEmpty,
  onRetry,
  onExpand,
  height = 320,
  className,
  children,
}: Props) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {onExpand && !isLoading && !isError && !isEmpty && (
          <Button variant="ghost" size="sm" onClick={onExpand} className="h-7 px-2" title="Visualizza dettaglio">
            <Maximize2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="space-y-3" style={{ height }}>
            <Skeleton className="h-full w-full" />
          </div>
        ) : isError ? (
          <div
            className="flex flex-col items-center justify-center text-center gap-3 text-destructive"
            style={{ height }}
          >
            <AlertCircle className="w-10 h-10" />
            <div>
              <p className="font-medium text-sm">Errore nel caricamento</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {error?.message || "Si è verificato un errore imprevisto."}
              </p>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Riprova
              </Button>
            )}
          </div>
        ) : isEmpty ? (
          <div
            className="flex flex-col items-center justify-center text-center gap-2 text-muted-foreground"
            style={{ height }}
          >
            <Inbox className="w-10 h-10 opacity-50" />
            <p className="text-sm font-medium">Nessun dato disponibile</p>
            <p className="text-xs max-w-xs">
              Prova a modificare i filtri (periodo, sede, compagnia) per ampliare la ricerca.
            </p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
