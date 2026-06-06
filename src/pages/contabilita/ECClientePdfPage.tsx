import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import PdfPreview from "@/components/PdfPreview";
import { buildECClientePdf, type ECClienteData, type ECClienteRow } from "@/lib/ec-cliente-pdf";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";

const FOOTER_LINES_DEFAULT = [
  "Via Mergellina, 2 – 80121 Napoli (IT) Tel. +39 081 7648268",
  "Corso di Porta Nuova, 16 - 20121 Milano (IT) Tel. +39 345 7353364",
  "Codice Fiscale, Partita IVA e Registrazione al Registro di Impresa di Napoli: 0120975037. R.E.A. 1001556",
  "Capitale Sociale I.V.: 40.000,00 Euro",
  "Iscrizione al Registro Unico degli Intermediari: B000180506",
];

const NOTE_LEGALI_DEFAULT = [
  "Esente da Iva art. 10 DPR 633 del 26/10/72.",
  "Esente da bollo art. 34 DPR 601 del 29/09/73",
];

const ECClientePdfPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const clienteId = params.get("clienteId") || "";
  const titoliIdsParam = params.get("titoliIds") || "";
  const periodoDal = params.get("periodoDal") || "";
  const periodoAl = params.get("periodoAl") || "";

  const titoliIds = useMemo(() => titoliIdsParam ? titoliIdsParam.split(",").filter(Boolean) : [], [titoliIdsParam]);

  const [luogoData, setLuogoData] = useState("");
  const [oggetto, setOggetto] = useState("Estratto conto premi");
  const [introTesto, setIntroTesto] = useState("Vi trasmettiamo l'estratto conto delle operazioni condotte, pregandoVi di provvedere al saldo secondo quanto previsto dall'Art. 1901 c.c. e comunque entro i termini previsti dalle polizze.");
  const [intestatarioConto, setIntestatarioConto] = useState("");
  const [bancaConto, setBancaConto] = useState("");
  const [iban, setIban] = useState("");
  const [ragioneSocialeFooter, setRagioneSocialeFooter] = useState("Consulbrokers Digital s.r.l.");
  const [noteFinali, setNoteFinali] = useState("");
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);

  // Cliente
  const { data: cliente } = useQuery({
    queryKey: ["ec-cli-pdf-cliente", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data } = await supabase
        .from("clienti")
        .select("id, tipo_cliente, nome, cognome, ragione_sociale, sesso, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, indirizzo_sede, cap_sede, citta_sede, provincia_sede")
        .eq("id", clienteId)
        .maybeSingle();
      return data as any;
    },
  });

  // Sede mittente (per intestazione: città, indirizzo, ecc.)
  const { data: sede } = useQuery({
    queryKey: ["ec-cli-pdf-sede", profile?.ufficio_id],
    enabled: !!profile?.ufficio_id,
    queryFn: async () => {
      const { data } = await supabase.from("uffici")
        .select("nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
        .eq("id", profile!.ufficio_id!)
        .maybeSingle();
      return data as any;
    },
  });

  // Conto bancario di incasso: catena Specialist → Sede del cliente → default Consulbrokers
  const { data: conto } = useQuery({
    queryKey: ["ec-cli-pdf-conto-resolved", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { resolveIbanCliente } = await import("@/lib/resolveIbanCliente");
      return await resolveIbanCliente(clienteId!);
    },
  });

  useEffect(() => {
    const cittaSede = sede?.citta || "Napoli";
    setLuogoData(`${cittaSede}, ${format(new Date(), "dd/MM/yyyy")}`);
  }, [sede]);

  useEffect(() => {
    if (conto) {
      if (conto.iban) setIban(conto.iban);
      if (conto.intestato_a) setIntestatarioConto(conto.intestato_a);
      if (conto.banca) setBancaConto(conto.banca);
    }
  }, [conto]);

  // Titoli del cliente
  const { data: titoli } = useQuery({
    queryKey: ["ec-cli-pdf-titoli", clienteId, titoliIds.join(","), periodoDal, periodoAl],
    enabled: !!clienteId,
    queryFn: async () => {
      let q = supabase
        .from("titoli")
        .select("id, numero_titolo, prodotto_nome, descrizione_polizza, premio_lordo, garanzia_da, durata_da, data_messa_cassa, data_decorrenza_rinnovo, ramo_id, compagnia_id, rami:ramo_id(codice, descrizione), compagnie:compagnia_id(nome, gruppo_compagnia, gruppi_compagnia:gruppo_compagnia_id(descrizione))")
        .eq("cliente_anagrafica_id", clienteId)
        .is("data_messa_cassa", null)
        .is("sostituisce_polizza", null);
      if (titoliIds.length > 0) {
        q = q.in("id", titoliIds);
      } else {
        if (periodoDal) q = q.gte("garanzia_da", periodoDal);
        if (periodoAl) q = q.lte("garanzia_da", periodoAl);
      }
      const { data, error } = await q.order("garanzia_da", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const buildData = (): ECClienteData => {
    const righe: ECClienteRow[] = (titoli || []).map((t: any) => {
      const ramoR = t.rami;
      const ramo = ramoR ? (ramoR.descrizione || ramoR.codice || "") : "";
      const rischio = t.prodotto_nome || t.descrizione_polizza || "";
      const eff = t.garanzia_da || t.durata_da;
      const effetto = eff ? format(new Date(eff), "dd/MM/yyyy") : "";
      return {
        polizza: t.numero_titolo || "",
        ramo,
        rischio,
        compagnia: t.compagnie?.gruppi_compagnia?.descrizione || t.compagnie?.gruppo_compagnia || t.compagnie?.nome || "",
        effetto,
        premio: Number(t.premio_lordo) || 0,
      };
    });
    const totale = righe.reduce((s, r) => s + r.premio, 0);

    // Cliente
    const isAzienda = cliente?.tipo_cliente === "azienda" || cliente?.tipo_cliente === "ente" || !!cliente?.ragione_sociale;
    const intestaz = isAzienda
      ? "Spett.le"
      : cliente?.sesso === "F" ? "Preg.ma Sig.ra" : "Preg.mo Sig.";
    const nome = isAzienda
      ? (cliente?.ragione_sociale || "")
      : `${cliente?.cognome || ""} ${cliente?.nome || ""}`.trim();
    const indirizzo = isAzienda ? cliente?.indirizzo_sede : cliente?.indirizzo_residenza;
    const cap = isAzienda ? cliente?.cap_sede : cliente?.cap_residenza;
    const citta = isAzienda ? cliente?.citta_sede : cliente?.citta_residenza;
    const prov = isAzienda ? cliente?.provincia_sede : cliente?.provincia_residenza;

    return {
      sedeNome: sede?.nome_ufficio || "",
      sedeIndirizzo: sede?.indirizzo || "",
      sedeCap: sede?.cap || "",
      sedeCitta: sede?.citta || "",
      sedeProvincia: sede?.provincia || "",
      sedeTelefono: sede?.telefono || "",
      sedeEmail: sede?.email || "",
      clienteIntestazione: intestaz,
      clienteNome: nome || "—",
      clienteIndirizzo: indirizzo || "",
      clienteCap: cap || "",
      clienteCitta: citta || "",
      clienteProvincia: prov || "",
      luogoData,
      oggetto,
      introTesto,
      righe,
      totale,
      intestatarioConto,
      bancaConto,
      iban,
      ragioneSocialeFooter,
      noteLegali: NOTE_LEGALI_DEFAULT,
      footerLines: FOOTER_LINES_DEFAULT,
    };
  };

  const fileName = () => {
    const cli = (cliente?.ragione_sociale || `${cliente?.cognome || ""}_${cliente?.nome || ""}`).replace(/\s+/g, "_") || "cliente";
    return `EC_${cli}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  };

  const handleAnteprima = async () => {
    try { setBusy(true); setPreviewBytes(await buildECClientePdf(buildData())); }
    catch (e: any) { toast.error("Errore anteprima: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const handleStampa = async () => {
    try {
      setBusy(true);
      const bytes = await buildECClientePdf(buildData());
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) w.addEventListener("load", () => { try { w.print(); } catch {} });
    } catch (e: any) { toast.error("Errore stampa: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const handleScarica = async () => {
    try {
      setBusy(true);
      const bytes = await buildECClientePdf(buildData());
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const name = fileName();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e: any) {
      toast.error("Errore download: " + (e?.message || e));
    } finally { setBusy(false); }
  };

  const handleSalva = async () => {
    try {
      setBusy(true);
      const bytes = await buildECClientePdf(buildData());
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const name = fileName();

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      if (clienteId) {
        const path = `${clienteId}/ec_cliente/${Date.now()}_${name}`;
        const { error: upErr } = await supabase.storage
          .from("documenti_generali")
          .upload(path, blob, { contentType: "application/pdf", upsert: false });
        if (upErr) throw upErr;
        const { data: u } = await supabase.auth.getUser();
        const { error: dbErr } = await supabase.from("documenti").insert({
          nome_file: name,
          path_storage: path,
          bucket_name: "documenti_generali",
          entita_tipo: "cliente",
          entita_id: clienteId,
          categoria: "EC Cliente",
          visibile_al_cliente: true,
          caricato_da: u?.user?.id ?? null,
        } as any);
        if (dbErr) throw dbErr;

        await logAttivita({
          azione: "stampa_ec_cliente",
          entita_tipo: "cliente",
          entita_id: clienteId,
          dettagli_json: { titoli: titoli?.length || 0, totale: buildData().totale },
        });
        toast.success("E/C cliente salvato e archiviato");
      } else {
        toast.success("PDF generato");
      }
    } catch (e: any) {
      toast.error("Errore salvataggio: " + (e?.message || e));
    } finally { setBusy(false); }
  };

  const conteggio = titoli?.length || 0;
  const totale = (titoli || []).reduce((s: number, t: any) => s + (Number(t.premio_lordo) || 0), 0);

  const clienteLabel = cliente?.ragione_sociale || `${cliente?.cognome || ""} ${cliente?.nome || ""}`.trim();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Estratto Conto Cliente</h1>
        <p className="text-sm text-muted-foreground mt-1">Genera anteprima, stampa e salva l'E/C verso il cliente</p>
      </div>

      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Dati Documento</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Input value={clienteLabel} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Polizze incluse</Label>
            <Input value={`${conteggio} polizze — Totale € ${totale.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} disabled />
          </div>
        </div>

        <div className="mt-2">
          <Label className="mb-2 block">Dettaglio polizze</Label>
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-primary/10 text-primary">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">N. Titolo</th>
                  <th className="text-left px-3 py-2 font-semibold">Ramo</th>
                  <th className="text-left px-3 py-2 font-semibold">Rischio</th>
                  <th className="text-left px-3 py-2 font-semibold">Compagnia</th>
                  <th className="text-center px-3 py-2 font-semibold">Effetto</th>
                  <th className="text-right px-3 py-2 font-semibold">Premio</th>
                </tr>
              </thead>
              <tbody>
                {(titoli || []).length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-4 text-center text-muted-foreground">Nessuna polizza selezionata</td></tr>
                )}
                {(titoli || []).map((t: any, i: number) => {
                  const ramo = t.rami ? (t.rami.descrizione || t.rami.codice || "") : "";
                  const rischio = t.prodotto_nome || t.descrizione_polizza || "";
                  const eff = t.garanzia_da || t.durata_da;
                  const effetto = eff ? format(new Date(eff), "dd/MM/yyyy") : "";
                  const premio = Number(t.premio_lordo) || 0;
                  return (
                    <tr key={t.id} className={i % 2 ? "bg-muted/30" : ""}>
                      <td className="px-3 py-2 font-mono text-xs">{t.numero_titolo || ""}</td>
                      <td className="px-3 py-2">{ramo}</td>
                      <td className="px-3 py-2">{rischio}</td>
                      <td className="px-3 py-2">{t.compagnie?.nome || ""}</td>
                      <td className="px-3 py-2 text-center">{effetto}</td>
                      <td className="px-3 py-2 text-right font-semibold">€ {premio.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })}
              </tbody>
              {(titoli || []).length > 0 && (
                <tfoot className="bg-primary/10 text-primary font-semibold">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-right">Totale EURO</td>
                    <td className="px-3 py-2 text-right">€ {totale.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Luogo e data</Label>
            <Input value={luogoData} onChange={(e) => setLuogoData(e.target.value)} placeholder="Es: Napoli, 18/03/2026" />
          </div>
          <div className="space-y-1.5">
            <Label>Oggetto</Label>
            <Input value={oggetto} onChange={(e) => setOggetto(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Testo introduttivo</Label>
            <Textarea value={introTesto} onChange={(e) => setIntroTesto(e.target.value)} rows={3} />
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Coordinate Bancarie</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Intestatario conto</Label>
            <Input value={intestatarioConto} onChange={(e) => setIntestatarioConto(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Banca</Label>
            <Input value={bancaConto} onChange={(e) => setBancaConto(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>IBAN</Label>
            <Input value={iban} onChange={(e) => setIban(e.target.value)} />
            {conto?.fonte && conto.fonte !== "nessuno" && (
              <p className="text-[11px] text-muted-foreground">
                Fonte:{" "}
                {conto.fonte === "specialist" && "Specialist assegnato al cliente"}
                {conto.fonte === "sede" && "Sede del cliente"}
                {conto.fonte === "default" && "Conto di default Consulbrokers"}
                {" "}— modificabile prima della stampa.
              </p>
            )}
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Ragione sociale (firma)</Label>
            <Input value={ragioneSocialeFooter} onChange={(e) => setRagioneSocialeFooter(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => navigate(-1)}>Chiudi</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAnteprima} disabled={busy}>Anteprima</Button>
          <Button variant="outline" onClick={handleStampa} disabled={busy}>Stampa</Button>
          <Button variant="outline" onClick={handleScarica} disabled={busy}>Scarica</Button>
          <Button onClick={handleSalva} disabled={busy}>Salva PDF</Button>
        </div>
      </div>

      <Dialog open={!!previewBytes} onOpenChange={(o) => { if (!o) setPreviewBytes(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-3">
            <DialogTitle>Anteprima E/C Cliente</DialogTitle>
          </DialogHeader>
          <PdfPreview data={previewBytes} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ECClientePdfPage;
