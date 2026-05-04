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
import { buildECProduttorePdf, type ECProduttoreData, type ECProduttoreRow } from "@/lib/ec-produttore-pdf";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";

const ECProduttorePdfPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const produttoreId = params.get("produttoreId") || "";
  const periodoDal = params.get("periodoDal") || "";
  const periodoAl = params.get("periodoAl") || "";

  const [numeroRendiconto, setNumeroRendiconto] = useState(params.get("numero") || "1");
  const [dataRendiconto, setDataRendiconto] = useState(params.get("dataEC") || format(new Date(), "dd/MM/yyyy"));
  const [periodoTesto, setPeriodoTesto] = useState(params.get("periodo") || "");
  const [noteFinali, setNoteFinali] = useState("");
  const [percRA, setPercRA] = useState<string>("11,50");
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsePerc = (s: string) => {
    const n = parseFloat((s || "").toString().replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };
  const normalizePerc = (s: string) => {
    const n = parsePerc(s);
    return n ? n.toString().replace(".", ",") : "";
  };

  // Sede mittente
  const [sedeNome, setSedeNome] = useState("");
  const [sedeIndirizzo, setSedeIndirizzo] = useState("");
  const [sedeCap, setSedeCap] = useState("");
  const [sedeCitta, setSedeCitta] = useState("");
  const [sedeProvincia, setSedeProvincia] = useState("");
  const [sedeEmail, setSedeEmail] = useState("");
  const [sedeTelefono, setSedeTelefono] = useState("");

  // Produttore
  const { data: produttore } = useQuery({
    queryKey: ["ec-pdf-produttore", produttoreId],
    enabled: !!produttoreId,
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, codice, nome, cognome, ragione_sociale, indirizzo, cap, citta, provincia, percentuale_ra, codice_fiscale, partita_iva")
        .eq("id", produttoreId).maybeSingle();
      return data as any;
    },
  });

  useEffect(() => {
    if (produttore?.percentuale_ra != null) setPercRA(String(produttore.percentuale_ra).replace(".", ","));
  }, [produttore?.percentuale_ra]);

  const { data: sede } = useQuery({
    queryKey: ["ec-pdf-prod-sede", profile?.ufficio_id],
    enabled: !!profile?.ufficio_id,
    queryFn: async () => {
      const { data } = await supabase.from("uffici")
        .select("nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
        .eq("id", profile!.ufficio_id!).maybeSingle();
      return data as any;
    },
  });

  const { data: tutteSedi } = useQuery({
    queryKey: ["ec-pdf-prod-tutte-sedi"],
    queryFn: async () => {
      const { data } = await supabase.from("uffici")
        .select("id, nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
        .eq("attivo", true).order("nome_ufficio");
      return data || [];
    },
  });

  useEffect(() => {
    if (sede && !sedeNome) {
      setSedeNome(sede.nome_ufficio || "");
      setSedeIndirizzo(sede.indirizzo || "");
      setSedeCap(sede.cap || ""); setSedeCitta(sede.citta || ""); setSedeProvincia(sede.provincia || "");
      setSedeEmail(sede.email || ""); setSedeTelefono(sede.telefono || "");
    }
  }, [sede]); // eslint-disable-line

  // Provvigioni del produttore con join titoli/cliente/ramo
  const { data: provvigioni } = useQuery({
    queryKey: ["ec-pdf-prod-prov", produttoreId, periodoDal, periodoAl],
    enabled: !!produttoreId,
    queryFn: async () => {
      const { data: prov, error } = await supabase
        .from("provvigioni_generate")
        .select("id, importo_provvigione, titolo_id, titoli!provvigioni_generate_titolo_id_fkey(id, numero_titolo, riga, appendice, sostituisce_polizza, premio_lordo, data_messa_cassa, data_incasso, garanzia_da, garanzia_a, durata_da, durata_a, ramo_id, cliente_anagrafica_id, produttore_id, anagrafica_commerciale_id, rami:ramo_id(descrizione, codice), clienti_anagrafica:cliente_anagrafica_id(nome, cognome, ragione_sociale))");
      if (error) throw error;
      // Filtra per produttore (commerciale): match su anagrafica_commerciale_id (preferito) o produttore_id
      const filtered = (prov || []).filter((p: any) => {
        const t = p.titoli; if (!t) return false;
        if (t.anagrafica_commerciale_id !== produttoreId && t.produttore_id !== produttoreId) return false;
        const d = t.data_messa_cassa || t.data_incasso;
        if (periodoDal && d && d < periodoDal) return false;
        if (periodoAl && d && d > periodoAl) return false;
        return true;
      });
      return filtered;
    },
  });

  const buildData = (): ECProduttoreData => {
    const righe: ECProduttoreRow[] = (provvigioni || []).map((p: any) => {
      const t = p.titoli;
      const cli = t?.clienti_anagrafica;
      const cliente = cli?.ragione_sociale || `${cli?.cognome || ""} ${cli?.nome || ""}`.trim() || "—";
      const ramo = t?.rami?.descrizione || t?.rami?.codice || "";
      const dFrom = t?.garanzia_da || t?.durata_da;
      const dTo = t?.garanzia_a || t?.durata_a;
      const periodo = (dFrom || dTo) ? `${dFrom ? format(new Date(dFrom), "dd/MM/yyyy") : ""} ${dTo ? format(new Date(dTo), "dd/MM/yyyy") : ""}`.trim() : "";
      const polRiga = `${t?.numero_titolo || ""}${t?.riga ? " - " + t.riga : ""}`;
      const tp = t?.appendice ? "AM" : (t?.sostituisce_polizza ? "PQ" : "PI");
      const dataRow = t?.data_messa_cassa || t?.data_incasso;
      return {
        data: dataRow ? format(new Date(dataRow), "dd/MM/yy") : "",
        polizza: polRiga,
        cliente,
        ramo,
        periodo,
        tp,
        premio: Number(t?.premio_lordo) || 0,
        provvigioni: Number(p.importo_provvigione) || 0,
        altreOper: 0,
      };
    }).sort((a, b) => {
      // Ordina per data ASC: parse dd/MM/yy
      const px = (s: string) => { const [d, m, y] = s.split("/").map(Number); return new Date(2000 + (y || 0), (m || 1) - 1, d || 1).getTime(); };
      return px(a.data) - px(b.data);
    });

    const totalePremio = righe.reduce((s, r) => s + r.premio, 0);
    const totaleProvvigioni = righe.reduce((s, r) => s + r.provvigioni, 0);
    const totaleAltreOper = righe.reduce((s, r) => s + r.altreOper, 0);
    const ra = (Number(percRA) || 0) * totaleProvvigioni / 100;

    const prodNome = produttore?.ragione_sociale || `${produttore?.cognome || ""} ${produttore?.nome || ""}`.trim() || "";

    return {
      sedeNome, sedeIndirizzo, sedeCap, sedeCitta, sedeProvincia, sedeEmail, sedeTelefono,
      numeroRendiconto, dataRendiconto, periodoTesto,
      produttoreIntestazione: "Spettabile",
      produttoreNome: prodNome,
      produttoreIndirizzo: produttore?.indirizzo || "",
      produttoreCap: produttore?.cap || "",
      produttoreCitta: produttore?.citta || "",
      produttoreProvincia: produttore?.provincia || "",
      righe, totalePremio, totaleProvvigioni, totaleAltreOper,
      ritenutaAcconto: ra,
      noteFinali,
    };
  };

  const fileName = () => {
    const p = (produttore?.codice || produttore?.cognome || produttore?.ragione_sociale || "produttore").toString().replace(/\s+/g, "_");
    return `EC_Produttore_${p}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  };

  const handleAnteprima = async () => {
    try { setBusy(true); setPreviewBytes(await buildECProduttorePdf(buildData())); }
    catch (e: any) { toast.error("Errore anteprima: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const handleStampa = async () => {
    try {
      setBusy(true);
      const bytes = await buildECProduttorePdf(buildData());
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
      const bytes = await buildECProduttorePdf(buildData());
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e: any) { toast.error("Errore download: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const handleSalva = async () => {
    try {
      setBusy(true);
      const bytes = await buildECProduttorePdf(buildData());
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const name = fileName();
      // Download anche in locale
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      if (produttoreId) {
        const path = `${produttoreId}/ec_produttore/${Date.now()}_${name}`;
        const { error: upErr } = await supabase.storage.from("documenti_generali")
          .upload(path, blob, { contentType: "application/pdf", upsert: false });
        if (upErr) throw upErr;
        const { data: u } = await supabase.auth.getUser();
        const { error: dbErr } = await supabase.from("documenti").insert({
          nome_file: name, path_storage: path, bucket_name: "documenti_generali",
          entita_tipo: "anagrafica_professionale", entita_id: produttoreId,
          categoria: "EC Produttore", visibile_al_cliente: false,
          caricato_da: u?.user?.id ?? null,
        } as any);
        if (dbErr) throw dbErr;
        await logAttivita({
          azione: "stampa_ec_produttore",
          entita_tipo: "anagrafica_professionale", entita_id: produttoreId,
          dettagli_json: { righe: provvigioni?.length || 0, numeroRendiconto, periodo: periodoTesto },
        });
        toast.success("E/C Produttore salvato e archiviato");
      } else {
        toast.success("PDF generato");
      }
    } catch (e: any) { toast.error("Errore salvataggio: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  const conteggio = provvigioni?.length || 0;
  const prodLabel = useMemo(() => produttore?.ragione_sociale || `${produttore?.cognome || ""} ${produttore?.nome || ""}`.trim() || "—", [produttore]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Estratto Conto Produttore</h1>
        <p className="text-sm text-muted-foreground mt-1">Genera anteprima, stampa e salva il rendiconto provvigioni</p>
      </div>

      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Dati Documento</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Produttore</Label><Input value={prodLabel} disabled /></div>
          <div className="space-y-1.5"><Label>Righe incluse</Label><Input value={`${conteggio} righe`} disabled /></div>
          <div className="space-y-1.5"><Label>Numero rendiconto</Label><Input value={numeroRendiconto} onChange={(e) => setNumeroRendiconto(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Data rendiconto</Label><Input value={dataRendiconto} onChange={(e) => setDataRendiconto(e.target.value)} placeholder="gg/mm/aaaa" /></div>
          <div className="space-y-1.5"><Label>Periodo (testo)</Label><Input value={periodoTesto} onChange={(e) => setPeriodoTesto(e.target.value)} placeholder="Es: Gennaio 2026" /></div>
          <div className="space-y-1.5"><Label>% Ritenuta d'Acconto</Label><Input value={percRA} onChange={(e) => setPercRA(e.target.value)} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Note finali (opzionale)</Label><Textarea value={noteFinali} onChange={(e) => setNoteFinali(e.target.value)} rows={2} /></div>
        </div>
      </fieldset>

      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Sede Mittente</legend>
        {(tutteSedi || []).length > 0 && (
          <div className="space-y-1.5">
            <Label>Carica dati da una Sede esistente</Label>
            <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(e) => {
                const u = (tutteSedi || []).find((x: any) => x.id === e.target.value); if (!u) return;
                setSedeNome(u.nome_ufficio || ""); setSedeIndirizzo(u.indirizzo || "");
                setSedeCap(u.cap || ""); setSedeCitta(u.citta || ""); setSedeProvincia(u.provincia || "");
                setSedeEmail(u.email || ""); setSedeTelefono(u.telefono || "");
              }} defaultValue="">
              <option value="" disabled>Scegli sede...</option>
              {(tutteSedi || []).map((u: any) => (<option key={u.id} value={u.id}>{u.nome_ufficio}</option>))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2"><Label>Nome Sede</Label><Input value={sedeNome} onChange={(e) => setSedeNome(e.target.value)} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Indirizzo</Label><Input value={sedeIndirizzo} onChange={(e) => setSedeIndirizzo(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>CAP</Label><Input value={sedeCap} onChange={(e) => setSedeCap(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Città</Label><Input value={sedeCitta} onChange={(e) => setSedeCitta(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Provincia</Label><Input value={sedeProvincia} onChange={(e) => setSedeProvincia(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Telefono</Label><Input value={sedeTelefono} onChange={(e) => setSedeTelefono(e.target.value)} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Email</Label><Input value={sedeEmail} onChange={(e) => setSedeEmail(e.target.value)} /></div>
        </div>
      </fieldset>

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => navigate(-1)}>Chiudi</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAnteprima} disabled={busy}>Anteprima</Button>
          <Button variant="outline" onClick={handleStampa} disabled={busy}>Stampa</Button>
          <Button variant="outline" onClick={handleScarica} disabled={busy}>Scarica PDF</Button>
          <Button onClick={handleSalva} disabled={busy}>Salva in archivio</Button>
        </div>
      </div>

      <Dialog open={!!previewBytes} onOpenChange={(o) => { if (!o) setPreviewBytes(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-3"><DialogTitle>Anteprima E/C Produttore</DialogTitle></DialogHeader>
          <PdfPreview data={previewBytes} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ECProduttorePdfPage;
