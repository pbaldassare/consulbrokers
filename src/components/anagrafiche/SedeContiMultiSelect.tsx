import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { applySedeContoDefault, applySedeContoToggle, type SedeContiSelection } from "@/lib/contiBancariSedi";

type ContoRow = {
  id: string;
  etichetta: string;
  iban: string;
  intestato_a: string;
  banca: string | null;
  is_default: boolean;
};

type Props = {
  value: SedeContiSelection;
  onChange: (next: SedeContiSelection) => void;
  disabled?: boolean;
};

const maskIban = (iban: string) => {
  if (!iban || iban.length < 8) return iban;
  return `${iban.slice(0, 4)} **** **** **** ${iban.slice(-4)}`;
};

export default function SedeContiMultiSelect({ value, onChange, disabled }: Props) {
  const { data: conti = [] } = useQuery({
    queryKey: ["conti_bancari", "sede-multi", "incasso_clienti"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conti_bancari" as any)
        .select("id, etichetta, iban, intestato_a, banca, is_default")
        .eq("attivo", true)
        .eq("tipo", "incasso_clienti")
        .order("etichetta");
      if (error) throw error;
      return (data || []) as unknown as ContoRow[];
    },
    staleTime: 60_000,
  });

  const selected = new Set(value.selectedIds);
  const ordered = [
    ...conti.filter((c) => selected.has(c.id)),
    ...conti.filter((c) => !selected.has(c.id)),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Conti selezionati</Label>
        <Badge variant="secondary" className="text-[10px]">
          {value.selectedIds.length} conto{value.selectedIds.length !== 1 ? "i" : ""}
        </Badge>
      </div>
      <ScrollArea className="h-56 rounded-md border bg-muted/20 p-2">
        {ordered.length === 0 ? (
          <p className="text-xs text-muted-foreground p-2">Nessun conto incasso clienti attivo.</p>
        ) : (
          ordered.map((c) => {
            const isOn = selected.has(c.id);
            const isDefault = isOn && value.defaultId === c.id;
            return (
              <div
                key={c.id}
                className="flex items-start gap-3 p-2 rounded hover:bg-background border border-transparent hover:border-border"
              >
                <Checkbox
                  checked={isOn}
                  disabled={disabled}
                  onCheckedChange={(on) => onChange(applySedeContoToggle(value, c.id, !!on))}
                  id={`sede-conto-${c.id}`}
                />
                <Label htmlFor={`sede-conto-${c.id}`} className="flex-1 cursor-pointer space-y-0.5">
                  <div className="text-sm font-medium">
                    {c.etichetta || c.banca || "Conto"}
                    {c.is_default ? " ⭐" : ""}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono">{maskIban(c.iban)}</div>
                  <div className="text-[11px] text-muted-foreground">{c.intestato_a}</div>
                </Label>
                {isOn && (
                  <Button
                    type="button"
                    variant={isDefault ? "default" : "outline"}
                    size="sm"
                    className="h-7 px-2 shrink-0"
                    disabled={disabled}
                    title="Conto di default per E/C cliente PDF"
                    onClick={() => onChange(applySedeContoDefault(value, c.id))}
                  >
                    <Star className="w-3.5 h-3.5 mr-1" />
                    {isDefault ? "Default E/C" : "Usa come default"}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
}
