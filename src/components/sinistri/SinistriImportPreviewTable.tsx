import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { buildPolizzaSelectOption } from "@/lib/titoliDisplay";
import {
  STATI_SINISTRO_IMPORT,
  type CompagniaImportMatch,
  type ImportRowStatus,
  type PolizzaImportMatch,
  type SinistroImportPreviewRow,
} from "@/lib/sinistriImportExcel";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

const statoLabel: Record<string, string> = {
  bozza: "Bozza",
  in_valutazione: "In valutazione",
  aperto: "Aperto",
  in_lavorazione: "In lavorazione",
  in_attesa_documenti: "In attesa documenti",
  in_liquidazione: "In liquidazione",
  chiuso: "Chiuso",
  respinto: "Respinto",
  archiviato: "Archiviato",
};

const statusBadge: Record<ImportRowStatus, string> = {
  ok: "bg-green-100 text-green-800 border-green-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  blocked: "bg-red-100 text-red-800 border-red-200",
};

type Props = {
  rows: SinistroImportPreviewRow[];
  polizze: PolizzaImportMatch[];
  compagnie: CompagniaImportMatch[];
  disabled?: boolean;
  onChange: (id: string, patch: Partial<SinistroImportPreviewRow>) => void;
};

export default function SinistriImportPreviewTable({
  rows,
  polizze,
  compagnie,
  disabled,
  onChange,
}: Props) {
  const polizzaOptions = polizze
    .filter((p) => !p._isCga && !String(p.id).startsWith("cga:"))
    .map((p) => buildPolizzaSelectOption(p));

  const compagniaOptions = compagnie.map((c) => ({
    value: c.id,
    label: c.nome,
    searchText: `${c.nome} ${c.codice || ""} ${c.tipo || ""}`,
  }));

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">Nessuna riga da mostrare.</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead className="min-w-[120px]">Accadimento *</TableHead>
            <TableHead className="min-w-[120px]">Denuncia *</TableHead>
            <TableHead className="min-w-[140px]">N. polizza</TableHead>
            <TableHead className="min-w-[220px]">Collegamento</TableHead>
            <TableHead className="min-w-[140px]">N. SX compagnia</TableHead>
            <TableHead className="min-w-[180px]">Compagnia</TableHead>
            <TableHead className="min-w-[120px]">Ramo</TableHead>
            <TableHead className="min-w-[150px]">Stato</TableHead>
            <TableHead className="min-w-[260px]">Descrizione *</TableHead>
            <TableHead className="min-w-[160px]">Esito</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className={row.status === "blocked" ? "bg-red-50/40" : undefined}>
              <TableCell className="align-top text-xs text-muted-foreground">{row.excelRow}</TableCell>
              <TableCell className="align-top">
                <Input
                  type="date"
                  value={row.data_evento}
                  disabled={disabled}
                  onChange={(e) => onChange(row.id, { data_evento: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top">
                <Input
                  type="date"
                  value={row.data_denuncia}
                  disabled={disabled}
                  onChange={(e) => onChange(row.id, { data_denuncia: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top">
                <div className="text-sm font-medium">{row.n_polizza || "—"}</div>
                {row.cliente_excel ? (
                  <p className="text-[11px] text-muted-foreground mt-1">Excel: {row.cliente_excel}</p>
                ) : null}
              </TableCell>
              <TableCell className="align-top space-y-2">
                <label className="flex items-start gap-2 text-xs cursor-pointer select-none">
                  <Checkbox
                    checked={row.sinistro_terzi}
                    disabled={disabled}
                    onCheckedChange={(c) => onChange(row.id, { sinistro_terzi: !!c })}
                    className="mt-0.5"
                  />
                  <span>Senza polizza CBnet</span>
                </label>
                {!row.sinistro_terzi && (
                  <SearchableSelect
                    options={polizzaOptions}
                    value={row.titolo_id || ""}
                    onValueChange={(val) => onChange(row.id, { titolo_id: val || null })}
                    placeholder="Collega polizza…"
                    clearable
                    clearLabel="— Nessuna polizza —"
                    disabled={disabled}
                    className="w-full"
                    showSelectedDescription
                  />
                )}
                {row.sinistro_terzi && (
                  <Badge variant="outline" className="border-amber-400 text-amber-800">
                    Terzi
                  </Badge>
                )}
              </TableCell>
              <TableCell className="align-top">
                <Input
                  value={row.numero_sinistro_compagnia}
                  disabled={disabled}
                  onChange={(e) => onChange(row.id, { numero_sinistro_compagnia: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top">
                <SearchableSelect
                  options={compagniaOptions}
                  value={row.compagnia_id || ""}
                  onValueChange={(val) => onChange(row.id, { compagnia_id: val || null })}
                  placeholder="Opzionale…"
                  clearable
                  clearLabel="— Nessuna —"
                  disabled={disabled || !row.sinistro_terzi}
                  className="w-full"
                />
              </TableCell>
              <TableCell className="align-top">
                <Input
                  value={row.ramo_sinistro}
                  disabled={disabled}
                  onChange={(e) => onChange(row.id, { ramo_sinistro: e.target.value })}
                />
              </TableCell>
              <TableCell className="align-top">
                <Select
                  value={row.stato}
                  disabled={disabled}
                  onValueChange={(val) => onChange(row.id, { stato: val as SinistroImportPreviewRow["stato"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATI_SINISTRO_IMPORT.filter((s) => s !== "bozza").map((s) => (
                      <SelectItem key={s} value={s}>{statoLabel[s] || s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="align-top">
                <Textarea
                  value={row.descrizione}
                  disabled={disabled}
                  rows={3}
                  onChange={(e) => onChange(row.id, { descrizione: e.target.value })}
                  className="min-w-[240px]"
                />
                <p className="text-[11px] text-muted-foreground mt-1">{row.descrizione.trim().length} caratteri</p>
              </TableCell>
              <TableCell className="align-top space-y-1">
                <Badge variant="outline" className={statusBadge[row.status]}>
                  {row.status === "ok" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                  {row.status === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
                  {row.status === "blocked" && <AlertCircle className="h-3 w-3 mr-1" />}
                  {row.status === "ok" ? "Pronta" : row.status === "warning" ? "Attenzione" : "Bloccata"}
                </Badge>
                {row.errors.map((e) => (
                  <p key={e} className="text-[11px] text-destructive">{e}</p>
                ))}
                {row.warnings.map((w) => (
                  <p key={w} className="text-[11px] text-amber-800">{w}</p>
                ))}
                {row.importResult && (
                  <p className={row.importResult.ok ? "text-[11px] text-green-700" : "text-[11px] text-destructive"}>
                    {row.importResult.ok
                      ? `Creato ${row.importResult.numero}`
                      : row.importResult.error}
                  </p>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
