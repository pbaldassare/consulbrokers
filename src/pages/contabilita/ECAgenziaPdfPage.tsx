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
import { buildECAgenziaPdf, type ECAgenziaData, type ECAgenziaTitolo } from "@/lib/ec-agenzia-pdf";
import { useAuth } from "@/contexts/AuthContext";
import { logAttivita } from "@/lib/logAttivita";
import { getProvvigioneEC } from "@/lib/getProvvigioneEC";
import { calcolaRitenutaAcconto, resolvePercentualeRA } from "@/lib/resolvePercentualeRA";

const mapTipoToMI = (tp?: string | null): string => {
  if (!tp) return "B";
  const v = tp.toLowerCase();
  if (v === "contanti") return "C";
  if (v === "bonifico") return "B";
  if (v === "assegno") return "A";
  if (v === "pos" || v === "carta_credito") return "B";
  return "*";
};

const mesiIt = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];

const ECAgenziaPdfPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const compagniaId = params.get("compagniaId") || "";
  const titoliIdsParam = params.get("titoliIds") || "";
  const periodoDal = params.get("periodoDal") || "";
  const periodoAl = params.get("periodoAl") || "";

  const titoliIds = useMemo(() => titoliIdsParam ? titoliIdsParam.split(",").filter(Boolean) : [], [titoliIdsParam]);

  const [riferimento, setRiferimento] = useState("");
  const [dataDocumento, setDataDocumento] = useState(format(new Date(), "dd/MM/yyyy"));
  const [periodoTesto, setPeriodoTesto] = useState("");
  const [modalitaPagamento, setModalitaPagamento] = useState("Bonifico");
  const [noteFinali, setNoteFinali] = useState("");
  const [previewBytes, setPreviewBytes] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState(false);

  // Override sede mittente (intestazione)
  const [sedeNome, setSedeNome] = useState("");
  const [sedeIndirizzo, setSedeIndirizzo] = useState("");
  const [sedeCap, setSedeCap] = useState("");
  const [sedeCitta, setSedeCitta] = useState("");
  const [sedeProvincia, setSedeProvincia] = useState("");
  const [sedeEmail, setSedeEmail] = useState("");
  const [sedeTelefono, setSedeTelefono] = useState("");

  // Agenzia
  const { data: compagnia } = useQuery({
    queryKey: ["ec-pdf-agenzia", compagniaId],
    enabled: !!compagniaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnie")
        .select("id, nome, codice, indirizzo, cap, comune, provincia, codice_fiscale, partita_iva, iban, intestato_a, percentuale_ra, mail_ec, mail, conto_bancario_id")
        .eq("id", compagniaId)
        .maybeSingle();
      return data as any;
    },
  });

  // Conto bancario master della compagnia: prima quello collegato, poi default per tipo 'agenzia'
  const { data: contoCompagnia } = useQuery({
    queryKey: ["ec-pdf-agenzia-conto", compagnia?.conto_bancario_id, compagniaId],
    enabled: !!compagniaId,
    queryFn: async () => {
      if (compagnia?.conto_bancario_id) {
        const { data } = await supabase.from("conti_bancari")
          .select("iban, intestato_a, banca")
          .eq("id", compagnia.conto_bancario_id)
          .maybeSingle();
        if (data) return data as any;
      }
      const { data } = await supabase.from("conti_bancari")
        .select("iban, intestato_a, banca")
        .eq("tipo", "agenzia")
        .eq("is_default", true)
        .eq("attivo", true)
        .maybeSingle();
      return data as any;
    },
  });

  // Tutte le sedi (per selezione manuale + lookup default)
  const { data: tutteSedi } = useQuery({
    queryKey: ["ec-pdf-tutte-sedi"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici")
        .select("id, nome_ufficio, indirizzo, cap, citta, provincia, email, telefono")
        .eq("attivo", true)
        .order("nome_ufficio");
      return data || [];
    },
  });

  // Titoli — se titoliIds presenti li usa, altrimenti tutti gli incassati dell'agenzia (filtrati per periodo se passato), escludendo quelli già in rimessa
  const { data: titoli } = useQuery({
    queryKey: ["ec-pdf-titoli", compagniaId, titoliIds.join(","), periodoDal, periodoAl],
    enabled: !!compagniaId,
    queryFn: async () => {
      let q = supabase
        .from("titoli")
        .select("id, numero_titolo, riga, premio_lordo, provvigioni_firma, provvigioni_quietanza, sostituisce_polizza, tipo_pagamento, data_messa_cassa, garanzia_da, garanzia_a, durata_da, durata_a, descrizione_polizza, cig_rif, cliente_anagrafica_id, ramo_id, ufficio_id, compagnia_rapporto_id, compagnia_rapporti:compagnia_rapporto_id(percentuale_ra), rami:ramo_id(codice, descrizione), clienti_anagrafica:cliente_anagrafica_id(nome, cognome, ragione_sociale)")
        .eq("compagnia_id", compagniaId)
        .eq("stato", "incassato");
      if (titoliIds.length > 0) {
        q = q.in("id", titoliIds);
      } else {
        if (periodoDal) q = q.gte("data_messa_cassa", periodoDal);
        if (periodoAl) q = q.lte("data_messa_cassa", periodoAl);
        // Escludi titoli già rimessati (solo quando non è una selezione esplicita)
        const { data: rimRaw } = await supabase.from("rimessa_dettaglio").select("titolo_id");
        const rimSet = new Set((rimRaw || []).map((r: any) => r.titolo_id));
        const { data, error } = await q.order("data_messa_cassa", { ascending: true });
        if (error) throw error;
        return (data || []).filter((t: any) => !rimSet.has(t.id));
      }
      const { data, error } = await q.order("data_messa_cassa", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-set period text from filtered/selected titles
  useEffect(() => {
    if (!titoli || titoli.length === 0 || periodoTesto) return;
    const dates = titoli.map((t: any) => t.data_messa_cassa).filter(Boolean).sort();
    if (dates.length) {
      const d = new Date(dates[dates.length - 1]);
      setPeriodoTesto(`${mesiIt[d.getMonth()]} ${d.getFullYear()}`);
    }
  }, [titoli]); // eslint-disable-line

  // Pre-popola Sede Mittente con l'ufficio più frequente fra i titoli inclusi.
  // Fallback: prima sede contenente "napoli". L'utente può sovrascrivere dal dropdown.
  useEffect(() => {
    if (sedeNome) return;
    if (!tutteSedi || tutteSedi.length === 0) return;
    if (!titoli) return;

    const counts = new Map<string, number>();
    for (const t of titoli) {
      if (t.ufficio_id) counts.set(t.ufficio_id, (counts.get(t.ufficio_id) || 0) + 1);
    }
    let chosenId: string | null = null;
    if (counts.size > 0) {
      chosenId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
    let u: any = chosenId ? (tutteSedi).find((s) => s.id === chosenId) : null;
    if (!u) {
      u = (tutteSedi).find(
        (s) =>
          (s.nome_ufficio || "").toLowerCase().includes("napoli") ||
          (s.citta || "").toLowerCase().includes("napoli"),
      );
    }
    if (!u) return;
    setSedeNome(u.nome_ufficio || "");
    setSedeIndirizzo(u.indirizzo || "");
    setSedeCap(u.cap || "");
    setSedeCitta(u.citta || "");
    setSedeProvincia(u.provincia || "");
    setSedeEmail(u.email || "");
    setSedeTelefono(u.telefono || "");
  }, [titoli, tutteSedi]); // eslint-disable-line

  useEffect(() => {
    if (compagnia?.codice && !riferimento) {
      setRiferimento(`${compagnia.codice}/${format(new Date(), "yyMMdd")}`);
    }
  }, [compagnia]); // eslint-disable-line

  const buildData = (): ECAgenziaData => {
    const rows: ECAgenziaTitolo[] = (titoli || []).map((t: any) => {
      const cli = t.clienti_anagrafica;
      const cliente = cli?.ragione_sociale || `${cli?.cognome || ""} ${cli?.nome || ""}`.trim() || "—";
      const noteCliente = t.cig_rif || "";
      const ramoR = t.rami;
      const ramo = ramoR ? (ramoR.descrizione || ramoR.codice || "") : "";
      const dFrom = t.garanzia_da || t.durata_da;
      const dTo = t.garanzia_a || t.durata_a;
      const periodo = (dFrom || dTo)
        ? `${dFrom ? format(new Date(dFrom), "dd/MM/yyyy") : "—"} ${dTo ? format(new Date(dTo), "dd/MM/yyyy") : ""}`.trim()
        : "";
      const polizzaRiga = `${t.numero_titolo || ""}${t.riga ? " - " + t.riga : ""}`.trim();
      const provv = getProvvigioneEC(t);
      return {
        polizza: polizzaRiga,
        cliente,
        noteCliente,
        ramo,
        periodo,
        tp: "AM",
        premio: Number(t.premio_lordo) || 0,
        provvigioni: provv,
        mi: mapTipoToMI(t.tipo_pagamento),
      };
    });
    const totalePremio = rows.reduce((s, r) => s + r.premio, 0);
    const totaleProvvigioni = rows.reduce((s, r) => s + r.provvigioni, 0);
    const compagniaRA = Number(compagnia?.percentuale_ra) || null;
    const ritenutaAcconto = (titoli || []).reduce((sum: number, t: any) => {
      const provv = getProvvigioneEC(t);
      const raEffettiva = resolvePercentualeRA({
        rapporto_percentuale_ra: t.compagnia_rapporti?.percentuale_ra,
        compagnia_percentuale_ra: compagniaRA,
      });
      return sum + calcolaRitenutaAcconto(provv, raEffettiva);
    }, 0);

    return {
      sedeNome,
      sedeIndirizzo,
      sedeCap,
      sedeCitta,
      sedeProvincia,
      sedeEmail,
      sedeTelefono,
      riferimento,
      dataDocumento,
      periodoTesto,
      modalitaPagamento,
      agenziaNome: compagnia?.nome || "",
      agenziaIndirizzo: compagnia?.indirizzo || "",
      agenziaCap: compagnia?.cap || "",
      agenziaCitta: compagnia?.comune || "",
      agenziaProvincia: compagnia?.provincia || "",
      agenziaCF: compagnia?.codice_fiscale || "",
      agenziaPIVA: compagnia?.partita_iva || "",
      iban: contoCompagnia?.iban || compagnia?.iban || "",
      intestatoA: contoCompagnia?.intestato_a || compagnia?.intestato_a || compagnia?.nome || "",
      titoli: rows,
      totalePremio,
      totaleProvvigioni,
      ritenutaAcconto,
      noteFinali,
    };
  };

  const fileName = () => {
    const ag = (compagnia?.codice || compagnia?.nome || "agenzia").replace(/\s+/g, "_");
    return `EC_Agenzia_${ag}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
  };

  const handleAnteprima = async () => {
    try {
      setBusy(true);
      const bytes = await buildECAgenziaPdf(buildData());
      setPreviewBytes(bytes);
    } catch (e: any) {
      toast.error("Errore anteprima: " + (e?.message || e));
    } finally { setBusy(false); }
  };

  const handleStampa = async () => {
    try {
      setBusy(true);
      const bytes = await buildECAgenziaPdf(buildData());
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (w) w.addEventListener("load", () => { try { w.print(); } catch {} });
    } catch (e: any) {
      toast.error("Errore stampa: " + (e?.message || e));
    } finally { setBusy(false); }
  };

  const handleSalva = async () => {
    try {
      setBusy(true);
      const bytes = await buildECAgenziaPdf(buildData());
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
      const name = fileName();

      // Download locale
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      // Salva in Archivio (entità: agenzia / compagnia)
      if (compagniaId) {
        const path = `${compagniaId}/ec_agenzia/${Date.now()}_${name}`;
        const { error: upErr } = await supabase.storage
          .from("documenti_generali")
          .upload(path, blob, { contentType: "application/pdf", upsert: false });
        if (upErr) throw upErr;
        const { data: u } = await supabase.auth.getUser();
        const { error: dbErr } = await supabase.from("documenti").insert({
          nome_file: name,
          path_storage: path,
          bucket_name: "documenti_generali",
          entita_tipo: "agenzia",
          entita_id: compagniaId,
          categoria: "EC Agenzia",
          visibile_al_cliente: false,
          caricato_da: u?.user?.id ?? null,
        } as any);
        if (dbErr) throw dbErr;

        await logAttivita({
          azione: "stampa_ec_agenzia",
          entita_tipo: "agenzia",
          entita_id: compagniaId,
          dettagli_json: { titoli: titoli?.length || 0, riferimento, periodo: periodoTesto },
        });
        toast.success("E/C salvato e archiviato");
      } else {
        toast.success("PDF generato");
      }
    } catch (e: any) {
      toast.error("Errore salvataggio: " + (e?.message || e));
    } finally { setBusy(false); }
  };

  const conteggio = titoli?.length || 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Estratto Conto Agenzia</h1>
        <p className="text-sm text-muted-foreground mt-1">Genera anteprima, stampa e salva l'E/C verso l'agenzia</p>
      </div>

      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Dati Documento</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Agenzia destinataria</Label>
            <Input value={compagnia?.nome || ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Titoli inclusi</Label>
            <Input value={`${conteggio} titoli`} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Riferimento</Label>
            <Input value={riferimento} onChange={(e) => setRiferimento(e.target.value)} placeholder="Es: BENAQ0/250338" />
          </div>
          <div className="space-y-1.5">
            <Label>Data documento</Label>
            <Input value={dataDocumento} onChange={(e) => setDataDocumento(e.target.value)} placeholder="gg/mm/aaaa" />
          </div>
          <div className="space-y-1.5">
            <Label>Periodo</Label>
            <Input value={periodoTesto} onChange={(e) => setPeriodoTesto(e.target.value)} placeholder="Es: Ottobre 2025" />
          </div>
          <div className="space-y-1.5">
            <Label>Modalità di pagamento</Label>
            <Input value={modalitaPagamento} onChange={(e) => setModalitaPagamento(e.target.value)} placeholder="Bonifico" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Note finali (opzionale)</Label>
            <Textarea value={noteFinali} onChange={(e) => setNoteFinali(e.target.value)} rows={2} />
          </div>
        </div>
      </fieldset>

      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Sede Mittente (intestazione)</legend>
        {(tutteSedi || []).length > 0 && (
          <div className="space-y-1.5">
            <Label>Carica dati da una Sede esistente</Label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(e) => {
                const u = (tutteSedi || []).find((x: any) => x.id === e.target.value);
                if (!u) return;
                setSedeNome(u.nome_ufficio || "");
                setSedeIndirizzo(u.indirizzo || "");
                setSedeCap(u.cap || "");
                setSedeCitta(u.citta || "");
                setSedeProvincia(u.provincia || "");
                setSedeEmail(u.email || "");
                setSedeTelefono(u.telefono || "");
              }}
              defaultValue=""
            >
              <option value="" disabled>Scegli sede...</option>
              {(tutteSedi || []).map((u: any) => (
                <option key={u.id} value={u.id}>{u.nome_ufficio}</option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nome Sede</Label>
            <Input value={sedeNome} onChange={(e) => setSedeNome(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Indirizzo</Label>
            <Input value={sedeIndirizzo} onChange={(e) => setSedeIndirizzo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>CAP</Label>
            <Input value={sedeCap} onChange={(e) => setSedeCap(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Città</Label>
            <Input value={sedeCitta} onChange={(e) => setSedeCitta(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Provincia</Label>
            <Input value={sedeProvincia} onChange={(e) => setSedeProvincia(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Telefono</Label>
            <Input value={sedeTelefono} onChange={(e) => setSedeTelefono(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Email</Label>
            <Input value={sedeEmail} onChange={(e) => setSedeEmail(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => navigate(-1)}>Chiudi</Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAnteprima} disabled={busy}>Anteprima</Button>
          <Button variant="outline" onClick={handleStampa} disabled={busy}>Stampa</Button>
          <Button onClick={handleSalva} disabled={busy}>Salva PDF</Button>
        </div>
      </div>

      <Dialog open={!!previewBytes} onOpenChange={(o) => { if (!o) setPreviewBytes(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-3">
            <DialogTitle>Anteprima E/C Agenzia</DialogTitle>
          </DialogHeader>
          <PdfPreview data={previewBytes} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ECAgenziaPdfPage;
