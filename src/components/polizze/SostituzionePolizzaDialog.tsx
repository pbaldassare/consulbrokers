import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { logAttivita } from "@/lib/logAttivita";
import { aggiornaNumeroPolizza } from "@/lib/aggiornaNumeroPolizza";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titoloId: string;
  numeroPolizza?: string;
  onDone?: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const CAUSALI = [
  "Cambio veicolo",
  "Cambio bene assicurato",
  "Variazione massimali",
  "Aggiornamento dati",
  "Altro",
];

const ensureExt = (displayName: string, originalName: string) => {
  const origExt = originalName.includes(".") ? originalName.split(".").pop()!.toLowerCase() : "";
  if (!origExt) return displayName;
  const lower = displayName.toLowerCase();
  return lower.endsWith("." + origExt) ? displayName : `${displayName}.${origExt}`;
};

export const SostituzionePolizzaDialog = ({ open, onOpenChange, titoloId, numeroPolizza, onDone }: Props) => {
  const queryClient = useQueryClient();
  const todayISO = new Date().toISOString().slice(0, 10);
  const fileRef = useRef<HTMLInputElement>(null);

  const [titoloRow, setTitoloRow] = useState<any>(null);
  const [veicoloRow, setVeicoloRow] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rateFuture, setRateFuture] = useState<any[]>([]);
  const [splitRows, setSplitRows] = useState<any[]>([]);

  const [dataSostituzione, setDataSostituzione] = useState(todayISO);
  const [causale, setCausale] = useState(CAUSALI[0]);
  const [motivo, setMotivo] = useState("");
  const [nuovoNumeroPolizza, setNuovoNumeroPolizza] = useState("");
  // Vehicle fields (used when RCA)
  const [targa, setTarga] = useState("");
  const [marca, setMarca] = useState("");
  const [modello, setModello] = useState("");
  const [telaio, setTelaio] = useState("");
  const [versione, setVersione] = useState("");
  const [tipoVeicolo, setTipoVeicolo] = useState("");
  const [tipoAlimentazione, setTipoAlimentazione] = useState("");
  const [cilindrata, setCilindrata] = useState("");
  const [potenzaKw, setPotenzaKw] = useState("");
  const [potenzaCv, setPotenzaCv] = useState("");
  const [posti, setPosti] = useState("");
  const [dataImmatricolazione, setDataImmatricolazione] = useState("");
  const [classeBm, setClasseBm] = useState("");
  const [provinciaCircolazione, setProvinciaCircolazione] = useState("");
  const [descrizioneOggetto, setDescrizioneOggetto] = useState("");
  const [ubicazioneRischio, setUbicazioneRischio] = useState("");
  const [valoreAssicurato, setValoreAssicurato] = useState("");
  const [riferimentoOggetto, setRiferimentoOggetto] = useState("");
  const [conguaglio, setConguaglio] = useState<string>("0");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");

  const isRca = !!veicoloRow || (titoloRow?.targa_telaio || "").length > 0;

  useEffect(() => {
    if (!open) return;
    setDataSostituzione(todayISO);
    setCausale(CAUSALI[0]);
    setMotivo("");
    setNuovoNumeroPolizza(numeroPolizza || "");
    setConguaglio("0");
    setFile(null);
    setDisplayName("");
    if (fileRef.current) fileRef.current.value = "";
    setLoading(true);
    (async () => {
      const { data: tit } = await supabase.from("titoli").select("*").eq("id", titoloId).single();
      setTitoloRow(tit);
      const { data: vp } = await supabase
        .from("veicoli_polizza")
        .select("*")
        .eq("titolo_id", titoloId)
        .maybeSingle();
      setVeicoloRow(vp);
      setTarga(vp?.targa || "");
      setMarca(vp?.marca || "");
      setModello(vp?.modello || "");
      setTelaio(vp?.telaio || "");
      setVersione(vp?.versione || "");
      setTipoVeicolo(vp?.tipo_veicolo || "");
      setTipoAlimentazione(vp?.tipo_alimentazione || "");
      setCilindrata(vp?.cc != null ? String(vp.cc) : "");
      setPotenzaKw(vp?.kw != null ? String(vp.kw) : "");
      setPotenzaCv(vp?.cv != null ? String(vp.cv) : "");
      setPosti(vp?.posti != null ? String(vp.posti) : "");
      setDataImmatricolazione(vp?.data_immatricolazione || "");
      setClasseBm(vp?.classe_bm || "");
      setProvinciaCircolazione(vp?.provincia_circolazione || "");
      setDescrizioneOggetto(tit?.descrizione_polizza || "");
      setUbicazioneRischio("");
      setValoreAssicurato("");
      setRiferimentoOggetto("");
      // future rates
      if (tit?.numero_titolo && tit?.riga != null) {
        const { data: future } = await supabase
          .from("titoli")
          .select("id, riga, garanzia_da, garanzia_a, premio_lordo, stato, data_messa_cassa")
          .eq("numero_titolo", tit.numero_titolo)
          .gte("riga", tit.riga)
          .order("riga", { ascending: true });
        setRateFuture(future || []);
      }
      const { data: splits } = await supabase
        .from("titoli_split_commerciali")
        .select("*")
        .eq("titolo_id", titoloId);
      setSplitRows(splits || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, titoloId, numeroPolizza]);

  const conguaglioNum = Number(conguaglio.replace(",", ".")) || 0;

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) {
      toast.error("Il file supera il limite di 10 MB");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setFile(f);
    setDisplayName(f.name);
  };

  const removeFile = () => {
    setFile(null);
    setDisplayName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!titoloRow) throw new Error("Titolo non caricato");
      if (!dataSostituzione) throw new Error("Data sostituzione obbligatoria");

      const intOrNull = (v: string) => {
        const n = Number(v);
        return Number.isFinite(n) && v.trim() !== "" ? Math.round(n) : null;
      };

      // Snapshot parametri precedenti / nuovi
      const parametriPrec: Record<string, any> = isRca
        ? {
            tipo: "veicolo",
            targa: veicoloRow?.targa || null,
            marca: veicoloRow?.marca || null,
            modello: veicoloRow?.modello || null,
            versione: veicoloRow?.versione || null,
            telaio: veicoloRow?.telaio || null,
            tipo_veicolo: veicoloRow?.tipo_veicolo || null,
            tipo_alimentazione: veicoloRow?.tipo_alimentazione || null,
            cilindrata: veicoloRow?.cc ?? null,
            potenza_kw: veicoloRow?.kw ?? null,
            potenza_cv: veicoloRow?.cv ?? null,
            posti: veicoloRow?.posti ?? null,
            data_immatricolazione: veicoloRow?.data_immatricolazione || null,
            classe_bm: veicoloRow?.classe_bm || null,
            provincia_circolazione: veicoloRow?.provincia_circolazione || null,
          }
        : {
            tipo: "oggetto_generico",
            descrizione: titoloRow.descrizione_polizza || null,
          };

      const parametriNew: Record<string, any> = isRca
        ? {
            tipo: "veicolo",
            targa,
            marca,
            modello,
            versione,
            telaio,
            tipo_veicolo: tipoVeicolo,
            tipo_alimentazione: tipoAlimentazione,
            cilindrata: intOrNull(cilindrata),
            potenza_kw: intOrNull(potenzaKw),
            potenza_cv: intOrNull(potenzaCv),
            posti: intOrNull(posti),
            data_immatricolazione: dataImmatricolazione || null,
            classe_bm: classeBm,
            provincia_circolazione: provinciaCircolazione,
          }
        : {
            tipo: "oggetto_generico",
            descrizione: descrizioneOggetto,
            ubicazione_rischio: ubicazioneRischio || null,
            valore_assicurato: valoreAssicurato ? Number(valoreAssicurato.replace(",", ".")) : null,
            riferimento_oggetto: riferimentoOggetto || null,
          };

      // 1. Update polizza madre con nuovi parametri tecnici
      if (isRca && veicoloRow?.id) {
        const { error: errVe } = await supabase
          .from("veicoli_polizza")
          .update({
            targa: targa || null,
            marca: marca || null,
            modello: modello || null,
            versione: versione || null,
            telaio: telaio || null,
            tipo_veicolo: tipoVeicolo || null,
            tipo_alimentazione: tipoAlimentazione || null,
            cc: intOrNull(cilindrata),
            kw: intOrNull(potenzaKw),
            cv: intOrNull(potenzaCv),
            posti: intOrNull(posti),
            data_immatricolazione: dataImmatricolazione || null,
            classe_bm: classeBm || null,
            provincia_circolazione: provinciaCircolazione || null,
          } as any)
          .eq("id", veicoloRow.id);
        if (errVe) throw errVe;
      }
      const { error: errTit } = await supabase
        .from("titoli")
        .update({
          data_sostituzione: dataSostituzione,
          causale_sostituzione: causale,
          motivo_sostituzione: motivo || null,
          ...(isRca ? { targa_telaio: targa || telaio || null } : {}),
          ...(!isRca ? { descrizione_polizza: descrizioneOggetto || null } : {}),
        } as any)
        .eq("id", titoloId);
      if (errTit) throw errTit;

      // 2. Titolo conguaglio (se != 0)
      let titoloConguaglioId: string | null = null;
      if (conguaglioNum !== 0) {
        // ultima riga corrente
        const maxRiga = Math.max(
          ...((rateFuture || []).map((r: any) => Number(r.riga || 0))),
          Number(titoloRow.riga || 0),
        );
        const nuovaRiga = maxRiga + 1;
        const labelData = dataSostituzione.split("-").reverse().join("/");
        const noteConguaglio =
          conguaglioNum >= 0
            ? `Conguaglio sostituzione ${labelData}`
            : `Rimborso conguaglio sostituzione ${labelData}`;

        const { data: insTit, error: errIns } = await supabase
          .from("titoli")
          .insert({
            numero_titolo: titoloRow.numero_titolo,
            cliente_id: titoloRow.cliente_id,
            cliente_anagrafica_id: titoloRow.cliente_anagrafica_id,
            compagnia_id: titoloRow.compagnia_id,
            compagnia_rapporto_id: (titoloRow as any).compagnia_rapporto_id,
            codice_rapporto: (titoloRow as any).codice_rapporto,
            ramo_id: titoloRow.ramo_id,
            prodotto_id: titoloRow.prodotto_id,
            prodotto_nome: titoloRow.prodotto_nome,
            ufficio_id: titoloRow.ufficio_id,
            ae_anagrafica_id: (titoloRow as any).ae_anagrafica_id,
            anagrafica_commerciale_id: (titoloRow as any).anagrafica_commerciale_id,
            commerciale_id: titoloRow.commerciale_id,
            percentuale_commerciale: titoloRow.percentuale_commerciale,
            percentuale_riparto: titoloRow.percentuale_riparto,
            garanzia_da: dataSostituzione,
            garanzia_a: dataSostituzione,
            premio_lordo: conguaglioNum,
            premio_netto: conguaglioNum,
            riga: nuovaRiga,
            sostituisce_polizza: titoloRow.numero_titolo,
            sostituisce_riga: titoloRow.riga,
            stato: "attivo",
            note: noteConguaglio,
            tipo_portafoglio: titoloRow.tipo_portafoglio,
            tipo_mandatario: titoloRow.tipo_mandatario,
          } as any)
          .select("id")
          .single();
        if (errIns) throw errIns;
        titoloConguaglioId = insTit!.id;

        // Copia split commerciali
        if (splitRows.length > 0) {
          const rows = splitRows.map((s: any) => ({
            titolo_id: titoloConguaglioId,
            anagrafica_commerciale_id: s.anagrafica_commerciale_id,
            commerciale_user_id: s.commerciale_user_id,
            percentuale: s.percentuale,
            ordine: s.ordine,
            note: s.note,
          }));
          await supabase.from("titoli_split_commerciali").insert(rows as any);
        }
      }

      // 3. Insert storico sostituzione
      const { data: { user } } = await supabase.auth.getUser();
      const { data: sostIns, error: errSost } = await supabase
        .from("titoli_sostituzioni")
        .insert({
          titolo_id: titoloId,
          data_sostituzione: dataSostituzione,
          causale,
          motivo: motivo || null,
          parametri_precedenti: parametriPrec,
          parametri_nuovi: parametriNew,
          conguaglio: conguaglioNum,
          titolo_conguaglio_id: titoloConguaglioId,
          created_by: user?.id || null,
        } as any)
        .select("id")
        .single();
      if (errSost) throw errSost;

      // 3b. Eventuale nuovo numero polizza emesso dalla compagnia
      const numeroCambiato = await aggiornaNumeroPolizza({
        titoloId,
        numeroCorrente: titoloRow.numero_titolo,
        numeroNuovo: nuovoNumeroPolizza,
        causale: "sostituzione",
        motivo: motivo || causale,
        riferimentoId: sostIns?.id || null,
      });

      // 4. Upload documento opzionale
      let documentoId: string | null = null;
      let documentoNome: string | null = null;
      if (file) {
        const finalName = ensureExt((displayName || file.name).trim() || file.name, file.name);
        const safeName = finalName.replace(/[^\w.\-]+/g, "_");
        const path = `titolo/${titoloId}/sostituzione_${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage.from("documenti_titoli").upload(path, file);
        if (upErr) throw upErr;
        const { data: docIns, error: docErr } = await supabase
          .from("documenti")
          .insert({
            nome_file: finalName,
            path_storage: path,
            bucket_name: "documenti_titoli",
            entita_tipo: "titolo",
            entita_id: titoloId,
            caricato_da: user?.id,
          })
          .select("id")
          .single();
        if (docErr) throw docErr;
        documentoId = docIns?.id || null;
        documentoNome = finalName;
      }

      // 5. Movimento SO
      const descrParts: string[] = [`Sostituzione (${causale})`];
      if (conguaglioNum !== 0) descrParts.push(`conguaglio ${conguaglioNum.toFixed(2)} €`);
      if (motivo) descrParts.push(motivo);
      if (documentoNome) descrParts.push(`allegato: ${documentoNome}`);
      await supabase.from("movimenti_polizza").insert({
        titolo_id: titoloId,
        tipo_documento: "SO",
        data_movimento: dataSostituzione,
        descrizione: descrParts.join(" — "),
        stato: "attivo",
      } as any);

      // 6. Log
      await logAttivita({
        azione: "sostituzione_polizza",
        entita_tipo: "titolo",
        entita_id: titoloId,
        dettagli_json: {
          data_sostituzione: dataSostituzione,
          causale,
          motivo,
          parametri_precedenti: parametriPrec,
          parametri_nuovi: parametriNew,
          conguaglio: conguaglioNum,
          titolo_conguaglio_id: titoloConguaglioId,
          sostituzione_id: sostIns?.id,
          documento_id: documentoId,
          documento_nome: documentoNome,
          numero_polizza_cambiato: numeroCambiato,
          numero_polizza_nuovo: numeroCambiato ? nuovoNumeroPolizza : null,
        },
      });

      return { titoloConguaglioId, documentoNome, numeroCambiato };
    },
    onSuccess: ({ titoloConguaglioId, documentoNome, numeroCambiato }) => {
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["timeline", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["documenti", "titolo", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-attive"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-storico"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      queryClient.invalidateQueries({ queryKey: ["veicoli-polizza", titoloId] });
      queryClient.invalidateQueries({ queryKey: ["titoli-numeri-storici", titoloId] });
      const parts: string[] = ["Polizza sostituita"];
      if (numeroCambiato) parts.push(`nuovo numero polizza ${nuovoNumeroPolizza}`);
      if (titoloConguaglioId) parts.push("titolo conguaglio creato");
      if (documentoNome) parts.push(`allegato "${documentoNome}" caricato`);
      toast.success(parts.join(" · "));
      onOpenChange(false);
      onDone?.();
    },
    onError: (err: any) => toast.error(err.message || "Errore durante la sostituzione"),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sostituzione Polizza</DialogTitle>
            <DialogDescription>
              {numeroPolizza ? `Polizza ${numeroPolizza}` : "Sostituzione oggetto assicurato"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="data-sost-dlg">Data sostituzione *</Label>
                <Input
                  id="data-sost-dlg"
                  type="date"
                  value={dataSostituzione}
                  onChange={(e) => setDataSostituzione(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="causale-sost-dlg">Causale *</Label>
                <Select value={causale} onValueChange={setCausale}>
                  <SelectTrigger id="causale-sost-dlg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CAUSALI.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="motivo-sost-dlg">Motivo</Label>
              <Textarea
                id="motivo-sost-dlg"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Note libere"
              />
            </div>

            {/* Nuovo numero polizza (se la compagnia ne emette uno diverso) */}
            <div className="border rounded-md p-3 space-y-2 bg-muted/20">
              <Label htmlFor="sost-nuovo-numero">Nuovo numero polizza (opzionale)</Label>
              <Input
                id="sost-nuovo-numero"
                value={nuovoNumeroPolizza}
                onChange={(e) => setNuovoNumeroPolizza(e.target.value)}
                placeholder={numeroPolizza || "Lascia vuoto per mantenere il numero attuale"}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Se la compagnia emette un nuovo numero a seguito della sostituzione, inseriscilo qui.
                Numero attuale: <span className="font-mono">{numeroPolizza || "—"}</span>.
                Il vecchio numero verrà archiviato nello storico della polizza.
              </p>
            </div>

            {/* Nuovi parametri oggetto */}
            <div className="border rounded-md p-3 space-y-3">
              <div className="text-sm font-semibold">Nuovi parametri oggetto</div>
              {isRca ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-targa">Targa</Label>
                      <Input id="sost-targa" value={targa} onChange={(e) => setTarga(e.target.value.toUpperCase())} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-telaio">Telaio</Label>
                      <Input id="sost-telaio" value={telaio} onChange={(e) => setTelaio(e.target.value.toUpperCase())} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-marca">Marca</Label>
                      <Input id="sost-marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-modello">Modello</Label>
                      <Input id="sost-modello" value={modello} onChange={(e) => setModello(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-versione">Versione / Allestimento</Label>
                      <Input id="sost-versione" value={versione} onChange={(e) => setVersione(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-tipo-veicolo">Tipo veicolo</Label>
                      <Input id="sost-tipo-veicolo" value={tipoVeicolo} onChange={(e) => setTipoVeicolo(e.target.value)} placeholder="Autovettura, Autocarro…" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-alim">Alimentazione</Label>
                      <Input id="sost-alim" value={tipoAlimentazione} onChange={(e) => setTipoAlimentazione(e.target.value)} placeholder="Benzina, Diesel, Elettrico…" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-cc">Cilindrata (cc)</Label>
                      <Input id="sost-cc" type="number" inputMode="numeric" value={cilindrata} onChange={(e) => setCilindrata(e.target.value)} className="tabular-nums" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-kw">Potenza (kW)</Label>
                      <Input id="sost-kw" type="number" inputMode="numeric" value={potenzaKw} onChange={(e) => setPotenzaKw(e.target.value)} className="tabular-nums" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-cv">Potenza (CV)</Label>
                      <Input id="sost-cv" type="number" inputMode="numeric" value={potenzaCv} onChange={(e) => setPotenzaCv(e.target.value)} className="tabular-nums" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-posti">Posti</Label>
                      <Input id="sost-posti" type="number" inputMode="numeric" value={posti} onChange={(e) => setPosti(e.target.value)} className="tabular-nums" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-imm">Data immatricolazione</Label>
                      <Input id="sost-imm" type="date" value={dataImmatricolazione} onChange={(e) => setDataImmatricolazione(e.target.value)} className="tabular-nums" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-bm">Classe BM</Label>
                      <Input id="sost-bm" value={classeBm} onChange={(e) => setClasseBm(e.target.value)} placeholder="es. 1" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-prov">Provincia di circolazione</Label>
                      <Input id="sost-prov" value={provinciaCircolazione} onChange={(e) => setProvinciaCircolazione(e.target.value.toUpperCase())} maxLength={2} placeholder="es. VE" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="sost-descrizione">Descrizione nuovo oggetto / partita</Label>
                    <Textarea
                      id="sost-descrizione"
                      value={descrizioneOggetto}
                      onChange={(e) => setDescrizioneOggetto(e.target.value)}
                      rows={2}
                      placeholder="Es. nuovo immobile, nuova merce trasportata, nuovo beneficiario…"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-ubicazione">Ubicazione / tratta del rischio</Label>
                      <Input
                        id="sost-ubicazione"
                        value={ubicazioneRischio}
                        onChange={(e) => setUbicazioneRischio(e.target.value)}
                        placeholder="Indirizzo immobile, tratta trasporto, sede attività…"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="sost-valore">Valore assicurato / massimale (€)</Label>
                      <Input
                        id="sost-valore"
                        type="number"
                        step="0.01"
                        value={valoreAssicurato}
                        onChange={(e) => setValoreAssicurato(e.target.value)}
                        className="tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sost-rif">Riferimento (matricola / beneficiario / contraente terzo)</Label>
                    <Input
                      id="sost-rif"
                      value={riferimentoOggetto}
                      onChange={(e) => setRiferimentoOggetto(e.target.value)}
                      placeholder="Opzionale — utile per Vita (beneficiario), Trasporti (merce), Property (matricola)…"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Questi campi vengono archiviati nello snapshot della sostituzione (visibile nella sezione "Sostituzioni / Storni" della polizza).
                  </p>
                </div>
              )}
            </div>

            {/* Conguaglio */}
            <div className="space-y-1.5">
              <Label htmlFor="conguaglio-dlg">
                Conguaglio (positivo = a carico cliente, negativo = rimborso)
              </Label>
              <Input
                id="conguaglio-dlg"
                type="number"
                step="0.01"
                value={conguaglio}
                onChange={(e) => setConguaglio(e.target.value)}
                className="tabular-nums"
              />
            </div>

            {/* Rate future di riferimento */}
            <div className="border rounded-md p-3 bg-muted/30">
              <div className="text-sm font-semibold mb-2">Rate del contratto (riferimento)</div>
              {loading ? (
                <div className="text-xs text-muted-foreground">Caricamento…</div>
              ) : rateFuture.length === 0 ? (
                <div className="text-xs text-muted-foreground">Nessuna rata trovata.</div>
              ) : (
                <ul className="text-xs space-y-1 tabular-nums">
                  {rateFuture.map((r: any) => (
                    <li key={r.id} className="flex justify-between gap-3">
                      <span>
                        Riga {r.riga} · {r.garanzia_da} → {r.garanzia_a}
                        {r.stato === "incassato" ? " · INCASSATA" : ""}
                      </span>
                      <span className="font-medium">{Number(r.premio_lordo || 0).toFixed(2)} €</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Le quietanze esistenti restano invariate. Eventuali differenze di premio sono raccolte nel titolo di conguaglio.
              </p>
            </div>

            {/* Allegato */}
            <div className="space-y-1.5 border-t pt-3">
              <Label>Documento allegato (opzionale)</Label>
              <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelected} />
              {!file ? (
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Paperclip className="w-4 h-4 mr-1" /> Seleziona file
                </Button>
              ) : (
                <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
                  <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nome del documento"
                    className="h-8 text-sm"
                  />
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={removeFile} title="Rimuovi">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Max 10 MB. Il nome è modificabile; l'estensione viene preservata.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Annulla</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={mutation.isPending || loading || !dataSostituzione}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma sostituzione polizza</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>Polizza <strong>{numeroPolizza || "—"}</strong>.</div>
                {nuovoNumeroPolizza && nuovoNumeroPolizza !== numeroPolizza && (
                  <div>Nuovo numero polizza: <strong className="font-mono">{nuovoNumeroPolizza}</strong> (il vecchio verrà archiviato)</div>
                )}
                <div>Data: <strong>{dataSostituzione}</strong> · Causale: <strong>{causale}</strong></div>
                {conguaglioNum !== 0 && (
                  <div>
                    Conguaglio: <strong>{conguaglioNum.toFixed(2)} €</strong>
                    {" "}({conguaglioNum >= 0 ? "a carico cliente" : "a rimborso cliente"})
                  </div>
                )}
                {file && <div>Allegato: <strong>{ensureExt((displayName || file.name).trim() || file.name, file.name)}</strong></div>}
                <div className="text-muted-foreground">Le quietanze esistenti non vengono toccate.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); mutation.mutate(); }}>
              Conferma sostituzione
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SostituzionePolizzaDialog;
