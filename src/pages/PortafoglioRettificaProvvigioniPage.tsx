import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import RoleGuard from "@/components/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Percent, Search, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { fmtEuro } from "@/lib/formatCurrency";
import {
  calcDeltaProvvigioni,
  formatRataLabel,
  validateNuovoImporto,
  validateRettificaNote,
  type QuietanzaRettificaSearchRow,
} from "@/lib/rettificaProvvigioniQuietanza";
import { searchQuietanzePerRettifica } from "@/lib/rettificaProvvigioniSearch";

const PortafoglioRettificaProvvigioniPage = () => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);
  const [selected, setSelected] = useState<QuietanzaRettificaSearchRow | null>(null);
  const [nuovoImportoStr, setNuovoImportoStr] = useState("");
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    data: results = [],
    isFetching,
    isError,
    error: searchError,
  } = useQuery({
    queryKey: ["rettifica-provv-search", debouncedSearch],
    enabled: debouncedSearch.trim().length >= 2 && !selected,
    queryFn: () => searchQuietanzePerRettifica(debouncedSearch),
  });

  const nuovoImporto = useMemo(() => {
    const n = parseFloat(nuovoImportoStr.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }, [nuovoImportoStr]);

  const delta = useMemo(
    () => (selected && nuovoImporto != null ? calcDeltaProvvigioni(selected.provvigioni_quietanza, nuovoImporto) : 0),
    [selected, nuovoImporto],
  );

  const noteError = validateRettificaNote(note);
  const importoError = validateNuovoImporto(nuovoImporto);
  const canSubmit = !!selected && !noteError && !importoError && delta !== 0;

  const resetForm = useCallback(() => {
    setSelected(null);
    setNuovoImportoStr("");
    setNote("");
    setSearch("");
    setConfirmOpen(false);
  }, []);

  const rettificaMutation = useMutation({
    mutationFn: async () => {
      if (!selected || nuovoImporto == null) throw new Error("Dati incompleti");
      const noteErr = validateRettificaNote(note);
      if (noteErr) throw new Error(noteErr);

      const { data, error } = await supabase.rpc("rettifica_provvigioni_quietanza", {
        p_titolo_id: selected.id,
        p_nuovo_importo: nuovoImporto,
        p_note: note.trim(),
        p_data_rettifica: format(new Date(), "yyyy-MM-dd"),
      });

      if (error) throw error;
      const result = data as {
        ok?: boolean;
        error?: string;
        in_rimessa?: boolean;
      } | null;
      if (!result?.ok) throw new Error(result?.error || "Rettifica non riuscita");
      return result;
    },
    onSuccess: (result) => {
      toast.success("Rettifica provvigioni applicata", {
        description: result.in_rimessa
          ? "Creato titolo rettifica E/C agenzie per il delta."
          : "Il nuovo importo comparirà al prossimo E/C agenzie.",
      });
      resetForm();
    },
    onError: (err: Error) => {
      toast.error("Errore rettifica", { description: err.message });
    },
  });

  const handleSelect = (row: QuietanzaRettificaSearchRow) => {
    setSelected(row);
    setNuovoImportoStr(String(row.provvigioni_quietanza ?? 0));
    setSearch("");
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    rettificaMutation.mutate();
  };

  const submit = () => {
    if (!canSubmit) return;
    if (Math.abs(delta) > 0) {
      setConfirmOpen(true);
    } else {
      rettificaMutation.mutate();
    }
  };

  return (
    <RoleGuard allowedRoles={["admin", "ufficio", "contabilita", "cfo"]} permissionKey="contabilita">
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Percent className="w-7 h-7 text-primary" />
            Rettifica Provvigioni Quietanza
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Modifica l&apos;importo provvigione di una quietanza già messa a cassa. Non modifica premio cliente né messa a cassa.
          </p>
        </div>

        {!selected ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cerca quietanza</CardTitle>
              <CardDescription>N° polizza, cliente o codice — solo quietanze incassate / a cassa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Es. 801505372 o CASE"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>

              {debouncedSearch.trim().length >= 2 && (
                <div className="border rounded-md overflow-hidden">
                  {isFetching ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Ricerca…
                    </div>
                  ) : isError ? (
                    <p className="text-sm text-destructive text-center py-8 px-4">
                      Errore ricerca: {(searchError as Error)?.message || "riprova"}
                    </p>
                  ) : results.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nessuna quietanza incassata / a cassa trovata
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Polizza / Quietanza</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Agenzia</TableHead>
                          <TableHead>Rata</TableHead>
                          <TableHead className="text-right">Provv.</TableHead>
                          <TableHead>Cassa</TableHead>
                          <TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((r) => (
                          <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleSelect(r)}>
                            <TableCell className="font-mono text-sm">{r.numero_titolo}</TableCell>
                            <TableCell>{r.cliente_nome_display || "—"}</TableCell>
                            <TableCell className="text-sm">{r.compagnia_nome || "—"}</TableCell>
                            <TableCell>{formatRataLabel(r.numero_rata, r.numero_rate_totali)}</TableCell>
                            <TableCell className="text-right font-mono">{fmtEuro(r.provvigioni_quietanza ?? 0)}</TableCell>
                            <TableCell className="text-sm">
                              {r.data_messa_cassa
                                ? format(new Date(r.data_messa_cassa), "dd/MM/yyyy", { locale: it })
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleSelect(r); }}>
                                Seleziona
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Quietanza selezionata</CardTitle>
                  <CardDescription className="font-mono">{selected.numero_titolo}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={resetForm}>
                  Cambia quietanza
                </Button>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Cliente</dt>
                    <dd className="font-medium">{selected.cliente_nome_display || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Agenzia</dt>
                    <dd>{selected.compagnia_nome || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Rata</dt>
                    <dd>{formatRataLabel(selected.numero_rata, selected.numero_rate_totali)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Premio lordo</dt>
                    <dd className="font-mono">{fmtEuro(selected.premio_lordo ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Provvigione attuale</dt>
                    <dd className="font-mono font-semibold">{fmtEuro(selected.provvigioni_quietanza ?? 0)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Data messa a cassa</dt>
                    <dd>
                      {selected.data_messa_cassa
                        ? format(new Date(selected.data_messa_cassa), "dd/MM/yyyy", { locale: it })
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Stato</dt>
                    <dd>
                      <Badge variant="outline">{selected.stato || "—"}</Badge>
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nuova provvigione</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nuovo-importo">Importo provvigione (€)</Label>
                  <Input
                    id="nuovo-importo"
                    type="text"
                    inputMode="decimal"
                    className="max-w-xs font-mono"
                    value={nuovoImportoStr}
                    onChange={(e) => setNuovoImportoStr(e.target.value)}
                  />
                  {importoError && <p className="text-sm text-destructive">{importoError}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note-rettifica">Note rettifica (obbligatorie)</Label>
                  <Textarea
                    id="note-rettifica"
                    rows={3}
                    placeholder="Motivo della rettifica, riferimento compagnia, ecc."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  {noteError && note.trim().length > 0 && <p className="text-sm text-destructive">{noteError}</p>}
                </div>

                <div
                  className={`rounded-lg border p-4 flex items-center gap-3 ${
                    delta > 0 ? "bg-emerald-50 border-emerald-200" : delta < 0 ? "bg-rose-50 border-rose-200" : "bg-muted/40"
                  }`}
                >
                  <AlertTriangle className={`w-5 h-5 shrink-0 ${delta !== 0 ? "text-amber-600" : "text-muted-foreground"}`} />
                  <div className="text-sm">
                    <p className="font-medium">Anteprima delta</p>
                    <p className="font-mono">
                      {fmtEuro(selected.provvigioni_quietanza ?? 0)} → {nuovoImporto != null ? fmtEuro(nuovoImporto) : "—"}
                      {" · "}
                      <span className={delta > 0 ? "text-emerald-700" : delta < 0 ? "text-rose-700" : ""}>
                        Δ {delta >= 0 ? "+" : ""}
                        {fmtEuro(delta)}
                      </span>
                    </p>
                  </div>
                </div>

                <Button
                  onClick={submit}
                  disabled={!canSubmit || rettificaMutation.isPending}
                  className="min-w-[140px]"
                >
                  {rettificaMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Elaborazione…
                    </>
                  ) : (
                    "Conferma rettifica"
                  )}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confermare la rettifica?</DialogTitle>
              <DialogDescription>
                Verrà applicata una variazione di{" "}
                <strong className="font-mono">
                  {delta >= 0 ? "+" : ""}
                  {fmtEuro(delta)}
                </strong>{" "}
                sulla provvigione della quietanza {selected?.numero_titolo}. L&apos;operazione aggiorna E/C produttori e,
                se la quietanza è già in rimessa agenzia, crea un titolo rettifica separato per il delta.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleConfirm} disabled={rettificaMutation.isPending}>
                Conferma
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </RoleGuard>
  );
};

export default PortafoglioRettificaProvvigioniPage;
