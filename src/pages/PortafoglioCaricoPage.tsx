import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { Clock, Search, ChevronLeft, ChevronRight, Euro, Banknote, CheckCheck } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import ServerPagination from "@/components/ServerPagination";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";

const PAGE_SIZE = 25;

type DateOverrides = Record<string, {
  data_messa_cassa: string;
  data_pagamento: string;
  data_decorrenza_rinnovo: string;
}>;

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const PortafoglioCaricoPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filtroCompagnia, setFiltroCompagnia] = useState("tutte");
  const [filtroRamo, setFiltroRamo] = useState("tutti");
  const [page, setPage] = useState(0);
  const [caricoDate, setCaricoDate] = useState(new Date());
  const [dateOverrides, setDateOverrides] = useState<DateOverrides>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const caricoStart = format(startOfMonth(caricoDate), "yyyy-MM-dd");
  const caricoEnd = format(endOfMonth(caricoDate), "yyyy-MM-dd");

  const { data: compagnie } = useQuery({
    queryKey: ["compagnie-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: rami } = useQuery({
    queryKey: ["rami-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, descrizione").eq("attivo", true).order("descrizione");
      return data || [];
    },
  });

  const { data: result, isLoading } = useQuery({
    queryKey: ["portafoglio-carico", search, filtroCompagnia, filtroRamo, page, caricoStart, caricoEnd],
    queryFn: async () => {
      let q = supabase.from("v_portafoglio_titoli" as any).select(
        "id, numero_titolo, compagnia_nome, ramo_nome, cliente_nome_display, cliente_codice, stato, garanzia_da, garanzia_a, data_scadenza, premio_lordo, rate, ae_nome, specialist, produttore_nome, provvigioni_firma, provvigioni_quietanza, targa_telaio, compagnia_id, ramo_id, data_messa_cassa, data_pagamento, data_decorrenza_rinnovo",
        { count: "exact" }
      ).gte("data_scadenza", caricoStart).lte("data_scadenza", caricoEnd).in("stato", ["attivo", "incassato"]);

      if (search) {
        q = q.or(`numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%`);
      }
      if (filtroCompagnia !== "tutte") q = q.eq("compagnia_id", filtroCompagnia);
      if (filtroRamo !== "tutti") q = q.eq("ramo_id", filtroRamo);

      const { data, count } = await q
        .order("data_scadenza", { ascending: true })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = result?.data || [];
  const totalCount = result?.count || 0;

  const { data: totaleData } = useQuery({
    queryKey: ["portafoglio-carico-totale", search, filtroCompagnia, filtroRamo, caricoStart, caricoEnd],
    queryFn: async () => {
      let q = supabase.from("v_portafoglio_titoli" as any).select("premio_lordo")
        .gte("data_scadenza", caricoStart).lte("data_scadenza", caricoEnd).in("stato", ["attivo", "incassato"]);
      if (search) {
        q = q.or(`numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%`);
      }
      if (filtroCompagnia !== "tutte") q = q.eq("compagnia_id", filtroCompagnia);
      if (filtroRamo !== "tutti") q = q.eq("ramo_id", filtroRamo);
      const { data } = await q;
      return (data || []).reduce((sum: number, r: any) => sum + (Number(r.premio_lordo) || 0), 0);
    },
  });
  const totalePremio = totaleData ?? 0;

  const getDates = (id: string) => {
    const today = todayStr();
    return dateOverrides[id] || {
      data_messa_cassa: today,
      data_pagamento: today,
      data_decorrenza_rinnovo: today,
    };
  };

  const setDateField = (id: string, field: keyof DateOverrides[string], value: string) => {
    setDateOverrides(prev => ({
      ...prev,
      [id]: { ...getDates(id), [field]: value },
    }));
  };

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
    queryClient.invalidateQueries({ queryKey: ["portafoglio-carico-totale"] });
  };

  const mettiACassa = useCallback(async (titoloId: string) => {
    const dates = getDates(titoloId);
    setLoadingIds(prev => new Set(prev).add(titoloId));
    try {
      const { error } = await supabase.from("titoli").update({
        stato: "incassato",
        data_incasso: dates.data_messa_cassa,
        data_messa_cassa: dates.data_messa_cassa,
        data_pagamento: dates.data_pagamento,
        data_decorrenza_rinnovo: dates.data_decorrenza_rinnovo,
      }).eq("id", titoloId);

      if (error) throw error;

      await logAttivita({
        azione: "messa_a_cassa",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: dates,
      });

      toast.success("Polizza messa a cassa");
      invalidateQueries();
    } catch (err: any) {
      toast.error("Errore: " + (err.message || "operazione fallita"));
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(titoloId);
        return next;
      });
    }
  }, [dateOverrides]);

  const mettiACassaTutti = useCallback(async () => {
    const attive = polizze.filter((p: any) => p.stato === "attivo");
    if (attive.length === 0) {
      toast.info("Nessuna polizza attiva da mettere a cassa");
      return;
    }
    setBulkLoading(true);
    let ok = 0, ko = 0;
    for (const p of attive) {
      const dates = getDates(p.id);
      const { error } = await supabase.from("titoli").update({
        stato: "incassato",
        data_incasso: dates.data_messa_cassa,
        data_messa_cassa: dates.data_messa_cassa,
        data_pagamento: dates.data_pagamento,
        data_decorrenza_rinnovo: dates.data_decorrenza_rinnovo,
      }).eq("id", p.id);
      if (error) { ko++; } else { ok++; }
    }
    if (ok > 0) {
      await logAttivita({
        azione: "messa_a_cassa_massiva",
        entita_tipo: "titolo",
        entita_id: "batch",
        dettagli_json: { messe_a_cassa: ok, errori: ko },
      });
    }
    toast.success(`${ok} polizze messe a cassa${ko > 0 ? `, ${ko} errori` : ""}`);
    invalidateQueries();
    setBulkLoading(false);
  }, [polizze, dateOverrides]);

  const fmtCurrency = (v: number | null) =>
    v != null ? `€ ${Number(v).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—";

  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), "dd/MM/yyyy") : "—";

  const frazLabel = (r: number | null) => {
    if (!r) return "—";
    const map: Record<number, string> = { 1: "Ann.", 2: "Sem.", 3: "Trim.", 4: "Quad.", 12: "Mens." };
    return map[r] || String(r);
  };

  const statoBadgeVariant = (stato: string) => {
    switch (stato) {
      case "attivo": return "default" as const;
      case "sospeso": return "secondary" as const;
      case "scaduto": return "destructive" as const;
      case "incassato": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  const polizzeAttive = polizze.filter((p: any) => p.stato === "attivo");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Carico del Mese</h1>
          <p className="text-sm text-muted-foreground">Polizze in scadenza da confermare o rinnovare</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => { setCaricoDate(d => subMonths(d, 1)); setPage(0); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center capitalize">
              {format(caricoDate, "MMMM yyyy", { locale: it })}
            </span>
            <Button variant="outline" size="icon" onClick={() => { setCaricoDate(d => addMonths(d, 1)); setPage(0); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {polizzeAttive.length > 0 && (
            <Button
              onClick={mettiACassaTutti}
              disabled={bulkLoading}
              className="gap-2"
            >
              <CheckCheck className="h-4 w-4" />
              {bulkLoading ? "In corso..." : `Metti a Cassa Tutti (${polizzeAttive.length})`}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-accent/50 p-3">
              <Clock className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Polizze in scadenza</p>
              <p className="text-2xl font-bold text-foreground">{totalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-3">
              <Euro className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Totale premio lordo</p>
              <p className="text-2xl font-bold text-foreground">{fmtCurrency(totalePremio)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per n° polizza, cliente, codice..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={filtroCompagnia} onValueChange={(v) => { setFiltroCompagnia(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Compagnia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutte">Tutte le compagnie</SelectItem>
            {compagnie?.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroRamo} onValueChange={(v) => { setFiltroRamo(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Ramo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Tutti i rami</SelectItem>
            {rami?.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.descrizione}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento...</div>
      ) : polizze.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Nessuna polizza trovata per questo mese</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Polizza</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Compagnia</TableHead>
                  <TableHead>Ramo</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead>Fraz</TableHead>
                  <TableHead className="text-right">Lordo</TableHead>
                  <TableHead>AE</TableHead>
                  <TableHead>Produttore</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-center">Messa a Cassa</TableHead>
                  <TableHead className="text-center">Pagamento</TableHead>
                  <TableHead className="text-center">Decorrenza</TableHead>
                  <TableHead className="text-center">Azione</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {polizze.map((p: any) => {
                  const isAttivo = p.stato === "attivo";
                  const dates = getDates(p.id);
                  const isProcessing = loadingIds.has(p.id);
                  return (
                    <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/titoli/${p.id}`)}>
                      <TableCell className="font-medium">{p.numero_titolo || "—"}</TableCell>
                      <TableCell>{p.cliente_nome_display || "—"}</TableCell>
                      <TableCell>{p.compagnia_nome || "—"}</TableCell>
                      <TableCell>{p.ramo_nome || "—"}</TableCell>
                      <TableCell>{fmtDate(p.data_scadenza)}</TableCell>
                      <TableCell>{frazLabel(p.rate)}</TableCell>
                      <TableCell className="text-right">{fmtCurrency(p.premio_lordo)}</TableCell>
                      <TableCell className="text-sm">{p.ae_nome || "—"}</TableCell>
                      <TableCell className="text-sm">{p.produttore_nome || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statoBadgeVariant(p.stato)}>{p.stato}</Badge>
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {isAttivo ? (
                          <Input
                            type="date"
                            value={dates.data_messa_cassa}
                            onChange={(e) => setDateField(p.id, "data_messa_cassa", e.target.value)}
                            className="w-[130px] h-8 text-xs mx-auto"
                          />
                        ) : (
                          <span className="text-xs">{fmtDate(p.data_messa_cassa)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {isAttivo ? (
                          <Input
                            type="date"
                            value={dates.data_pagamento}
                            onChange={(e) => setDateField(p.id, "data_pagamento", e.target.value)}
                            className="w-[130px] h-8 text-xs mx-auto"
                          />
                        ) : (
                          <span className="text-xs">{fmtDate(p.data_pagamento)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {isAttivo ? (
                          <Input
                            type="date"
                            value={dates.data_decorrenza_rinnovo}
                            onChange={(e) => setDateField(p.id, "data_decorrenza_rinnovo", e.target.value)}
                            className="w-[130px] h-8 text-xs mx-auto"
                          />
                        ) : (
                          <span className="text-xs">{fmtDate(p.data_decorrenza_rinnovo)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        {isAttivo ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isProcessing}
                            onClick={() => mettiACassa(p.id)}
                            className="gap-1 h-8 text-xs"
                          >
                            <Banknote className="h-3.5 w-3.5" />
                            {isProcessing ? "..." : "Cassa"}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">✓</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <ServerPagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
};

export default PortafoglioCaricoPage;
