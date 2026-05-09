import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const KpiCardSkeleton = () => (
  <Card>
    <CardContent className="p-4 flex items-center gap-3">
      <Skeleton className="h-11 w-11 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-28" />
      </div>
    </CardContent>
  </Card>
);

export const KpiRowSkeleton = ({ count = 5 }: { count?: number }) => (
  <div className={`grid grid-cols-2 md:grid-cols-${count} gap-3`}>
    {Array.from({ length: count }).map((_, i) => <KpiCardSkeleton key={i} />)}
  </div>
);

export const ChartSkeleton = () => (
  <Card>
    <CardHeader className="pb-2"><Skeleton className="h-4 w-40" /></CardHeader>
    <CardContent className="h-[260px] flex items-end gap-2 pb-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${30 + ((i * 37) % 70)}%` }} />
      ))}
    </CardContent>
  </Card>
);

export const FiltersBarSkeleton = () => (
  <div className="rounded-lg border bg-card p-4 flex flex-wrap items-end gap-3">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="space-y-1">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-[160px]" />
      </div>
    ))}
  </div>
);

export const TableRowsSkeleton = ({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) => (
  <div className="divide-y">
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex items-center gap-3 px-4 py-3">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);
