import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, TrendingUp, Percent, Filter, FileText, Eye, Printer, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";
import { toast } from "sonner";
import PdfPreview from "@/components/PdfPreview";
import { buildECProduttorePdf, type ECProduttoreData, type ECProduttoreRow } from "@/lib/ec-produttore-pdf";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";

type MeseFiltro = "corrente" | "scorso";

const meseRange = (m: MeseFiltro) => {
  const ref = m === "corrente" ? new Date() : subMonths(new Date(), 1);
  return {
    from: startOfMonth(ref),
    to: endOfMonth(ref),
    label: format(ref, "LLLL yyyy", { locale: it }).replace(/^./, (c) => c.toUpperCase()),
  };
};

const ECProduttoriContabPage = () => {
  const { profile } = useAuth();
  const [mese, setMese] = useState<MeseFiltro>("corrente");
  const [produttoreId, setProduttoreId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewProdId, setPreviewProdId] = useState<string | null>(null);

  const range = useMemo(() => meseRange(mese), [mese]);
  const fromIso = format(range.from, "yyyy-MM-dd");
  const toIso = format(range.to, "yyyy-MM-dd");

  const { data: anagrafiche } = useQuery({
    queryKey: ["anagrafiche-produttori-ec"],
    queryFn: async () => {
      const { data } = await supabase.from("anagrafiche_professionali")
        .select("id, codice, cognome, nome, ragione_sociale, citta, fax, email, indirizzo, cap, provincia, percentuale_ra, tipo")
        .in("tipo", ["account_executive", "corrispondente"])
        .eq("attivo", true).order("cognome");
      return data || [];
    },
  });

  // Provvigioni del periodo (solo titoli messi a cassa nel mese)
  const { data: provvAll, isLoading } = useQuery({
    queryKey: ["ec-produttori-mese", fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provvigioni_generate")
        .select("user_id, anagrafica_commerciale_id, importo_provvigione, tipo_destinatario, solo_statistico, titolo_id, titoli!provvigioni_generate_titolo_id_fkey(id, numero_titolo, riga, appendice, sostituisce_polizza, premio_lordo, data_messa_cassa, garanzia_da, garanzia_a, durata_da, durata_a, ramo_id, cliente_anagrafica_id, produttore_id, anagrafica_commerciale_id, rami:ramo_id(descrizione, codice), clienti_anagrafica:cliente_anagrafica_id(nome, cognome, ragione_sociale))")
        .in("tipo_destinatario", ["commerciale", "ae"])
        .eq("solo_statistico", false);
      if (error) throw error;
      return (data || []).filter((p: any) => {
        const t = p.titoli; if (!t || !t.data_messa_cassa) return false;
        return t.data_messa_cassa >= fromIso && t.data_messa_cassa <= toIso;
      });
    },
  });

  const aggregati = useMemo(() => {
    const prods = anagrafiche || [];
    const grouped: Record<string, { id: string; codice: string; nome: string; citta: string; fax: string; email: string; lordo: number; provvigioni: number }> = {};
    for (const a of prods) {
      grouped[a.id] = { id: a.id, codice: a.codice || "", nome: a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim(), citta: a.citta || "", fax: a.fax || "", email: a.email || "", lordo: 0, provvigioni: 0 };
    }
    for (const p of provvAll || []) {
      const t = p.titoli;
      const anagId = p.anagrafica_commerciale_id || t?.anagrafica_commerciale_id || null;
      const key = (anagId && grouped[anagId]) ? anagId : (p.user_id && grouped[p.user_id]) ? p.user_id : null;
      if (key) {
        grouped[key].lordo += Number(t?.premio_lordo) || 0;
        grouped[key].provvigioni += Number(p.importo_provvigione) || 0;
      }
    }
    let rows = Object.values(grouped).filter(r => r.lordo > 0 || r.provvigioni > 0);
    if (produttoreId) rows = rows.filter(r => r.id === produttoreId);
    return rows.sort((a, b) => b.lordo - a.lordo);
  }, [anagrafiche, provvAll, produttoreId]);

  const totLordo = aggregati.reduce((s, r) => s + r.lordo, 0);
  const totProvv = aggregati.reduce((s, r) => s + r.provvigioni, 0);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  const exportCSV = () => {
    const header = "Codice,Produttore,Località,Email,Lordo,Provvigioni\n";
    const csv = aggregati.map((r) => `"${r.codice}","${r.nome}","${r.citta}","${r.email}",${r.lordo.toFixed(2)},${r.provvigioni.toFixed(2)}`).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ec_produttori_${fromIso}_${toIso}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Sede mittente (utente loggato)
  const { data: sede } = useQuery({
    queryKey: ["ec-prod-sede", profile?.ufficio_id],
    enabled: !!profile?.ufficio_id,
    queryFn: async () => {
      const { data } = await supabase.from("uffici")
        .select("nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
        .eq("id", profile!.ufficio_id!).maybeSingle();
      return data as any;
    },
  });

  const buildPdfFor = async (prodId: string): Promise<{ bytes: Uint8Array; filename: string; prodCodice: string }> => {
    const prod = (anagrafiche || []).find((a: any) => a.id === prodId) as any;
    if (!prod) throw new Error("Produttore non trovato");

    const righeProv = (provvAll || []).filter((p: any) => {
      const anagId = p.anagrafica_commerciale_id || p.titoli?.anagrafica_commerciale_id || null;
      const key = anagId || p.user_id;
      return key === prodId;
    });

    const righe: ECProduttoreRow[] = righeProv.map((p: any) => {
      const t = p.titoli;
      const cli = t?.clienti_anagrafica;
      const cliente = cli?.ragione_sociale || `${cli?.cognome || ""} ${cli?.nome || ""}`.trim() || "—";
      const ramo = t?.rami?.descrizione || t?.rami?.codice || "";
      const dFrom = t?.garanzia_da || t?.durata_da;
      const dTo = t?.garanzia_a || t?.durata_a;
      const periodo = (dFrom || dTo) ? `${dFrom ? format(new Date(dFrom), "dd/MM/yyyy") : ""} ${dTo ? format(new Date(dTo), "dd/MM/yyyy") : ""}`.trim() : "";
      const polRiga = `${t?.numero_titolo || ""}${t?.riga ? " - " + t.riga : ""}`;
      const tp = t?.appendice ? "AM" : (t?.sostituisce_polizza ? "PQ" : "PI");
      const dataRow = t?.data_messa_cassa;
      return {
        data: dataRow ? format(new Date(dataRow), "dd/MM/yy") : "",
        polizza: polRiga, cliente, ramo, periodo, tp,
        premio: Number(t?.premio_lordo) || 0,
        provvigioni: Number(p.importo_provvigione) || 0,
        altreOper: 0,
      };
    }).sort((a, b) => {
      const px = (s: string) => { const [d, m, y] = s.split("/").map(Number); return new Date(2000 + (y || 0), (m || 1) - 1, d || 1).getTime(); };
      return px(a.data) - px(b.data);
    });

    const totalePremio = righe.reduce((s, r) => s + r.premio, 0);
    const totaleProvvigioni = righe.reduce((s, r) => s + r.provvigioni, 0);
    const percRA = Number(prod.percentuale_ra) || 0;

    const data: ECProduttoreData = {
      sedeNome: sede?.nome_ufficio || "",
      sedeIndirizzo: sede?.indirizzo || "", sedeCap: sede?.cap || "", sedeCitta: sede?.citta || "",
      sedeProvincia: sede?.provincia || "", sedeEmail: sede?.email || "", sedeTelefono: sede?.telefono || "",
      numeroRendiconto: "1",
      dataRendiconto: format(new Date(), "dd/MM/yyyy"),
      periodoTesto: range.label,
      produttoreIntestazione: "Spettabile",
      produttoreNome: prod.ragione_sociale || `${prod.cognome || ""} ${prod.nome || ""}`.trim() || "",
      produttoreIndirizzo: prod.indirizzo || "", produttoreCap: prod.cap || "",
      produttoreCitta: prod.citta || "", produttoreProvincia: prod.provincia || "",
      righe, totalePremio, totaleProvvigioni, totaleAltreOper: 0,
      ritenutaAcconto: percRA * totaleProvvigioni / 100,
    };
    const bytes = await buildECProduttorePdf(data);
    const codice = (prod.codice || prod.cognome || prod.ragione_sociale || "produttore").toString().replace(/\s+/g, "_");
    const filename = `EC_Produttore_${codice}_${fromIso}_${toIso}.pdf`;
    return { bytes, filename, prodCodice: codice };
  };

  const withObjectUrl = (bytes: Uint8Array, fn: (url: string) => void) => {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    try { fn(url); } finally { setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 5000); }
  };

  const handleAnteprima = async (prodId: string) => {
    try {
      setBusy(true);
      const { bytes } = await buildPdfFor(prodId);
      setPreviewBytes(bytes);
      setPreviewProdId(prodId);
      setPreviewOpen(true);
    } catch (e: any) { toast.error("Errore anteprima: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const handleStampa = async (prodId: string) => {
    try {
      setBusy(true);
      const { bytes } = await buildPdfFor(prodId);
      withObjectUrl(bytes, (url) => {
        const w = window.open(url, "_blank");
        if (w) w.addEventListener("load", () => { try { w.print(); } catch {} });
      });
    } catch (e: any) { toast.error("Errore stampa: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const handleSalva = async (prodId: string) => {
    try {
      setBusy(true);
      const { bytes, filename } = await buildPdfFor(prodId);
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      withObjectUrl(bytes, (url) => {
        const a = document.createElement("a"); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
      });
      const path = `${prodId}/ec_produttore/${Date.now()}_${filename}`;
      const { error: upErr } = await supabase.storage.from("documenti_generali")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (upErr) throw upErr;
      const { data: u } = await supabase.auth.getUser();
      const { error: dbErr } = await supabase.from("documenti").insert({
        nome_file: filename, path_storage: path, bucket_name: "documenti_generali",
        entita_tipo: "anagrafica_professionale", entita_id: prodId,
        categoria: "EC Produttore", visibile_al_cliente: false,
        caricato_da: u?.user?.id ?? null,
      } as any);
      if (dbErr) throw dbErr;
      await logAttivita({
        azione: "stampa_ec_produttore",
        entita_tipo: "anagrafica_professionale", entita_id: prodId,
        dettagli_json: { periodo: range.label, mese },
      });
      toast.success("E/C Produttore salvato e archiviato");
    } catch (e: any) { toast.error("Errore salvataggio: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const kpiCards = [
    { label: "Totale Lordo", value: fmt(totLordo), icon: TrendingUp, color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400" },
    { label: "Totale Provvigioni", value: fmt(totProvv), icon: Percent, color: "text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Percent className="w-5 h-5 text-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">E/C Produttori</h1>
            <p className="text-sm text-muted-foreground">Estratto conto produttori — solo titoli messi a cassa</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCSV} disabled={!aggregati.length}><Download className="mr-2 h-4 w-4" /> Esporta CSV</Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}><CardContent className="p-4 flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", kpi.color)}><kpi.icon className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground">{kpi.label}</p><p className="text-lg font-bold">{isLoading ? "..." : kpi.value}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="bg-muted/30 border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" /> <span>Filtri</span>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-2">
            {(["corrente", "scorso"] as MeseFiltro[]).map((m) => {
              const r = meseRange(m);
              return (
                <Button key={m} type="button" size="sm"
                  variant={mese === m ? "default" : "outline"}
                  onClick={() => setMese(m)}>
                  {m === "corrente" ? "Mese corrente" : "Mese scorso"} · {r.label}
                </Button>
              );
            })}
          </div>
          <FilterSearchableSelect
            value={produttoreId}
            onValueChange={setProduttoreId}
            options={(anagrafiche || []).map((a: any) => ({ value: a.id, label: a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`.trim() }))}
            placeholder="Produttore" allLabel="Tutti i produttori" className="w-[260px]"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Codice</TableHead><TableHead>Produttore</TableHead><TableHead>Località</TableHead><TableHead>Email</TableHead>
            <TableHead className="text-right">Lordo</TableHead><TableHead className="text-right">Provvigioni</TableHead>
            <TableHead className="text-right w-[280px]">Azioni</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
            ) : aggregati.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessun produttore con movimenti messi a cassa nel mese selezionato</TableCell></TableRow>
            ) : aggregati.map((r, i) => (
              <TableRow key={r.id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                <TableCell>{r.codice}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.citta}</TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell className="text-right">{fmt(r.lordo)}</TableCell>
                <TableCell className="text-right">{fmt(r.provvigioni)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => handleAnteprima(r.id)}><Eye className="h-3.5 w-3.5 mr-1" />Anteprima</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => handleStampa(r.id)}><Printer className="h-3.5 w-3.5 mr-1" />Stampa</Button>
                    <Button size="sm" disabled={busy} onClick={() => handleSalva(r.id)}><Save className="h-3.5 w-3.5 mr-1" />Salva</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          {aggregati.length > 0 && <TableFooter><TableRow>
            <TableCell colSpan={4} className="font-bold">Totale</TableCell>
            <TableCell className="text-right font-bold">{fmt(totLordo)}</TableCell>
            <TableCell className="text-right font-bold">{fmt(totProvv)}</TableCell>
            <TableCell />
          </TableRow></TableFooter>}
        </Table>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Anteprima E/C Produttore — {range.label}</DialogTitle>
          </DialogHeader>
          <PdfPreview data={previewBytes} />
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => previewProdId && handleStampa(previewProdId)} disabled={busy}><Printer className="h-4 w-4 mr-1" />Stampa</Button>
            <Button onClick={() => previewProdId && handleSalva(previewProdId)} disabled={busy}><Save className="h-4 w-4 mr-1" />Salva in archivio</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ECProduttoriContabPage;
