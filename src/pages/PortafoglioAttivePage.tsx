import { useState, useEffect, useMemo } from "react";
import { useServerPagination } from "@/hooks/useServerPagination";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { Shield, Search, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NuovaPolizzaButton } from "@/components/shared/NuovaPolizzaButton";
import { format, startOfMonth, endOfMonth } from "date-fns";
import ServerPagination from "@/components/ServerPagination";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { RamoSottoramoFilter, expandRamoFilter } from "@/components/polizze/RamoSottoramoFilter";
import { useRamiAll } from "@/hooks/useRamiLookup";
import { useAnticipiResiduoByClienti } from "@/hooks/useAnticipiResiduoByClienti";
import AnticipoUtilizziDrawer from "@/components/clienti/AnticipoUtilizziDrawer";
import { useCompensazioniByTitoli } from "@/hooks/useCompensazioniByTitoli";
import { CompensazioneBadge } from "@/components/portafoglio/CompensazioneBadge";
const PortafoglioAttivePage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filtroGruppoRamo, setFiltroGruppoRamo] = useState<string | null>(null);
  const [filtroRamo, setFiltroRamo] = useState<string | null>(null);
  const [escludiMeseCorrente, setEscludiMeseCorrente] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<"tutti" | "polizze" | "quietanze" | "regolazioni">("tutti");

  const today = format(new Date(), "yyyy-MM-dd");
  const inizioMese = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const fineMese = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const { data: ramiAll = [] } = useRamiAll();
  const { ramoIds: filterRamoIds } = expandRamoFilter(filtroGruppoRamo, filtroRamo, ramiAll);
  const { page, setPage, pageSize, range } = useServerPagination(25, [search, filtroGruppoRamo, filtroRamo, escludiMeseCorrente, filtroTipo]);

  const applyTipoFilter = (q: any) => {
    if (filtroTipo === "polizze") return q.is("sostituisce_polizza", null).or("is_regolazione.is.null,is_regolazione.eq.false");
    if (filtroTipo === "quietanze") return q.not("sostituisce_polizza", "is", null).or("is_regolazione.is.null,is_regolazione.eq.false");
    if (filtroTipo === "regolazioni") return q.eq("is_regolazione", true);
    return q;
  };


  const { data: result, isLoading } = useQuery({
    queryKey: ["portafoglio-attive", search, filterRamoIds, page, today, escludiMeseCorrente, filtroTipo],
    queryFn: async () => {
      let q = supabase.from("v_portafoglio_quietanze").select(
        "id, numero_titolo, compagnia_nome, ramo_nome, cliente_nome_display, cliente_codice, cliente_anagrafica_id, stato, garanzia_da, garanzia_a, data_scadenza, premio_lordo, rate, ae_nome, specialist, produttore_nome, provvigioni_firma, provvigioni_quietanza, targa_telaio, compagnia_id, ramo_id, sostituisce_polizza, is_regolazione, regolazione_quietanza_id",
        { count: "exact" }
      ).in("stato", ["attivo", "sospeso"]).gte("garanzia_a", today);

      if (escludiMeseCorrente) {
        q = q.or(`data_scadenza.lt.${inizioMese},data_scadenza.gt.${fineMese},data_scadenza.is.null`);
      }

      if (search) {
        q = q.or(`numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%,targa_telaio.ilike.%${search}%`);
      }
      if (filterRamoIds && filterRamoIds.length > 0) q = q.in("ramo_id", filterRamoIds);
      q = applyTipoFilter(q);

      const { data, count } = await q
        .order("garanzia_a", { ascending: true })
        .range(range.from, range.to);
      return { data: data || [], count: count || 0 };
    },
  });

  const polizze = result?.data || [];
  const totalCount = result?.count || 0;

  const clienteIdsRiga = useMemo(
    () => polizze.map((p: any) => p.cliente_anagrafica_id).filter(Boolean),
    [polizze]
  );
  const { data: anticipiMap } = useAnticipiResiduoByClienti(clienteIdsRiga);
  const titoloIdsRiga = useMemo(() => polizze.map((p: any) => p.id), [polizze]);
  const { data: compensazioniMap } = useCompensazioniByTitoli(titoloIdsRiga);
  const [anticipoDrawerId, setAnticipoDrawerId] = useState<string | null>(null);

  const { data: totaleData } = useQuery({
    queryKey: ["portafoglio-attive-totale", search, filterRamoIds, today, escludiMeseCorrente],
    queryFn: async () => {
      let q = supabase.from("v_portafoglio_quietanze").select("premio_lordo")
        .in("stato", ["attivo", "sospeso"]).gte("garanzia_a", today);
      if (escludiMeseCorrente) {
        q = q.or(`data_scadenza.lt.${inizioMese},data_scadenza.gt.${fineMese},data_scadenza.is.null`);
      }
      if (search) {
        q = q.or(`numero_titolo.ilike.%${search}%,cliente_nome_display.ilike.%${search}%,cliente_codice.ilike.%${search}%,targa_telaio.ilike.%${search}%`);
      }
      if (filterRamoIds && filterRamoIds.length > 0) q = q.in("ramo_id", filterRamoIds);
      const { data } = await q;
      return (data || []).reduce((sum: number, r: any) => sum + (Number(r.premio_lordo) || 0), 0);
    },
  });

  const fmtCurrency = (v: number | null) =>
    v != null ? `€ ${Number(v).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—";

  const fmtDate = (d: string | null) =>
    d ? format(new Date(d), "dd/MM/yyyy") : "—";

  const frazLabel = (r: number | null) => {
    if (!r) return "—";
    const map: Record<number, string> = { 1: "Ann.", 2: "Sem.", 3: "Trim.", 4: "Quad.", 12: "Mens." };
    return map[r] || String(r);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Polizze Attive</h1>
          <p className="text-sm text-muted-foreground">Polizze in corso di validità</p>
        </div>
        <NuovaPolizzaButton />
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Polizze attive</p>
            <p className="text-2xl font-bold text-foreground">{totalCount}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per n° polizza, cliente, codice, targa..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <RamoSottoramoFilter
          gruppoRamoId={filtroGruppoRamo}
          ramoId={filtroRamo}
          onChange={({ gruppoRamoId, ramoId }) => {
            setFiltroGruppoRamo(gruppoRamoId);
            setFiltroRamo(ramoId);
            setPage(0);
          }}
        />
        <Select value={filtroTipo} onValueChange={(v: any) => { setFiltroTipo(v); setPage(0); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tutti">Polizze + Quietanze + Reg.</SelectItem>
            <SelectItem value="polizze">Solo polizze</SelectItem>
            <SelectItem value="quietanze">Solo quietanze</SelectItem>
            <SelectItem value="regolazioni">Solo regolazioni</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 ml-auto">
          <Switch
            id="escludi-mese"
            checked={escludiMeseCorrente}
            onCheckedChange={(v) => { setEscludiMeseCorrente(v); setPage(0); }}
          />
          <Label htmlFor="escludi-mese" className="text-sm cursor-pointer whitespace-nowrap">
            Escludi scadenze del mese
          </Label>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Caricamento...</div>
      ) : polizze.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Nessuna polizza trovata</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Polizza</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Anticipo</TableHead>
                  <TableHead>Agenzia</TableHead>
                  <TableHead>Garanzia</TableHead>
                  <TableHead>Targa</TableHead>
                  <TableHead>Scadenza</TableHead>
                  <TableHead>Fraz</TableHead>
                  <TableHead className="text-right">Lordo</TableHead>
                  <TableHead className="text-right">Attive</TableHead>
                  <TableHead className="text-right">Passive</TableHead>
                  <TableHead>AE</TableHead>
                  <TableHead>Specialist</TableHead>
                  <TableHead>Produttore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {polizze.map((p: any) => (
                  <TableRow key={p.id} className={`cursor-pointer ${p.is_regolazione ? "bg-orange-50/40" : ""}`} onClick={() => navigate(rowHref(p))}>
                    <TableCell className="font-medium">
                      {p.is_regolazione && <span className="text-orange-600 mr-1" title="Regolazione collegata">↳</span>}
                      {p.numero_titolo || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {p.is_regolazione
                          ? <Badge className="bg-orange-500 hover:bg-orange-600 text-white" title="Titolo di Regolazione Premio">Regolazione</Badge>
                          : p.sostituisce_polizza
                            ? <Badge variant="secondary">Quietanza</Badge>
                            : <Badge variant="default">Polizza</Badge>}
                        {p.stato === "sospeso" && (
                          <Badge variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-50">Sospesa</Badge>
                        )}
                        <CompensazioneBadge summary={compensazioniMap?.get(p.id)} titoloId={p.id} />
                      </div>
                    </TableCell>
                    <TableCell>{p.cliente_nome_display || "—"}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {(() => {
                        const summary = p.cliente_anagrafica_id ? anticipiMap?.get(p.cliente_anagrafica_id) : null;
                        if (!summary || summary.totale <= 0) return <span className="text-xs text-muted-foreground">—</span>;
                        return (
                          <Badge
                            className="bg-emerald-600 hover:bg-emerald-700 cursor-pointer gap-1"
                            title={`${summary.conteggio} anticip${summary.conteggio === 1 ? "o" : "i"} disponibil${summary.conteggio === 1 ? "e" : "i"} — click per dettagli`}
                            onClick={() => setAnticipoDrawerId(summary.primoAnticipoId)}
                          >
                            <Wallet className="h-3 w-3" />
                            {fmtCurrency(summary.totale)}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{p.compagnia_nome || "—"}</TableCell>
                    <TableCell>{p.ramo_nome || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{p.targa_telaio || "—"}</TableCell>
                    <TableCell>{fmtDate(p.data_scadenza)}</TableCell>
                    <TableCell>{frazLabel(p.rate)}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(p.premio_lordo)}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(p.provvigioni_firma)}</TableCell>
                    <TableCell className="text-right">{fmtCurrency(p.provvigioni_quietanza)}</TableCell>
                    <TableCell className="text-sm">{p.ae_nome || "—"}</TableCell>
                    <TableCell className="text-sm">{p.specialist || "—"}</TableCell>
                    <TableCell className="text-sm">{p.produttore_nome || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ServerPagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} />
        </>
      )}
      <AnticipoUtilizziDrawer anticipoId={anticipoDrawerId} onClose={() => setAnticipoDrawerId(null)} />
    </div>
  );
};

export default PortafoglioAttivePage;
