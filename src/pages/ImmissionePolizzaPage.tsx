import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import AiDocumentScanner from "@/components/AiDocumentScanner";
import type { DocumentType } from "@/components/AiDocumentScanner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const ImmissionePolizzaPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);

  // Form state — Cliente
  const [codiceCliente, setCodiceCliente] = useState("");
  const [selectedAE, setSelectedAE] = useState("");
  const [selectedClienteId, setSelectedClienteId] = useState("");

  // Form state — Polizza
  const [numeroPolizza, setNumeroPolizza] = useState("");
  const [riga, setRiga] = useState("0");
  const [appendice, setAppendice] = useState("000");
  const [tipoOperazione, setTipoOperazione] = useState("polizza");
  const [polizzaAuto, setPolizzaAuto] = useState(false);
  const scannedFileRef = useRef<File | null>(null);

  // Contratto
  const [selectedCompagnia, setSelectedCompagnia] = useState("");
  const [selectedRamo, setSelectedRamo] = useState("");
  const [selectedProdotto, setSelectedProdotto] = useState("");
  const [specialist, setSpecialist] = useState("");
  const [tipoPortafoglio, setTipoPortafoglio] = useState("diretto");
  const [cigRif, setCigRif] = useState("");
  const [vincolo, setVincolo] = useState("");
  const [targaTelaio, setTargaTelaio] = useState("");
  const [descrizionePolizza, setDescrizionePolizza] = useState("");

  // Periodo
  const [durataDa, setDurataDa] = useState("");
  const [durataA, setDurataA] = useState("");
  const [anniDurata, setAnniDurata] = useState("1");
  const [tipoRinnovo, setTipoRinnovo] = useState("tacito_rinnovo");
  const [rate, setRate] = useState("1");
  const [moraGiorni, setMoraGiorni] = useState("15");
  const [garanziaDa, setGaranziaDa] = useState("");
  const [garanziaA, setGaranziaA] = useState("");
  const [dataCompetenza, setDataCompetenza] = useState("");
  const [limiteMora, setLimiteMora] = useState("");
  const [disdettaMesi, setDisdettaMesi] = useState("");

  // Regolazione
  const [regolazione, setRegolazione] = useState(false);
  const [tipoLetteraRegolazione, setTipoLetteraRegolazione] = useState("");
  const [tipoScadenza, setTipoScadenza] = useState("no_scadenza");
  const [giorniPresentazione, setGiorniPresentazione] = useState("");
  const [periodicita, setPeriodicita] = useState("annuale");
  const [libroMatricola, setLibroMatricola] = useState("no");

  // Importi
  const [premioNetto, setPremioNetto] = useState("");
  const [addizionali, setAddizionali] = useState("0");
  const [tasse, setTasse] = useState("");
  const [valuta, setValuta] = useState("EUR");
  // Quietanza
  const [premioNettoQuietanza, setPremioNettoQuietanza] = useState("");
  const [addizionaliQuietanza, setAddizionaliQuietanza] = useState("0");
  const [tasseQuietanza, setTasseQuietanza] = useState("");
  // Flags
  const [rimborso, setRimborso] = useState(false);
  const [indicizzata, setIndicizzata] = useState(false);
  const [noCalcoloTasse, setNoCalcoloTasse] = useState(false);
  const [pagDirettoCompagnia, setPagDirettoCompagnia] = useState(false);
  const [emissioneFee, setEmissioneFee] = useState(false);
  const [formatoElettronico, setFormatoElettronico] = useState(false);
  const [faxIncasso, setFaxIncasso] = useState("no");
  const [cambio, setCambio] = useState("1");
  // Copertura & Incasso
  const [coperturaDa, setCoperturaDa] = useState("");
  const [coperturaNumero, setCoperturaNumero] = useState("");
  const [dataIncasso, setDataIncasso] = useState("");
  const [numeroIncasso, setNumeroIncasso] = useState("");

  // Provvigioni
  const [percentualeProvvigione, setPercentualeProvvigione] = useState("");
  const [provvigioneFromDb, setProvvigioneFromDb] = useState(false);
  const [provvigioneOriginalValue, setProvvigioneOriginalValue] = useState("");
  const [provvigioneDbRecordId, setProvvigioneDbRecordId] = useState<string | null>(null);
  const [showProvvigioneDialog, setShowProvvigioneDialog] = useState(false);
  const [provvigioneDialogType, setProvvigioneDialogType] = useState<"new" | "update">("new");

  // === RCA AUTO State ===
  // Veicolo
  const [vSettore, setVSettore] = useState("Autovetture");
  const [vTipoVeicolo, setVTipoVeicolo] = useState("AUTOVETTURA");
  const [vUso, setVUso] = useState("PRIVATO");
  const [vMarca, setVMarca] = useState("");
  const [vModello, setVModello] = useState("");
  const [vVersione, setVVersione] = useState("");
  const [vTarga, setVTarga] = useState("");
  const [vTelaio, setVTelaio] = useState("");
  const [vDescrizione, setVDescrizione] = useState("");
  const [vDataImmatricolazione, setVDataImmatricolazione] = useState("");
  const [vAnnoAcquisto, setVAnnoAcquisto] = useState("");
  const [vProvinciaCircolazione, setVProvinciaCircolazione] = useState("");
  const [vClasseBm, setVClasseBm] = useState("");
  const [vMass1, setVMass1] = useState("0");
  const [vMass2, setVMass2] = useState("0");
  const [vMass3, setVMass3] = useState("0");
  const [vPeius, setVPeius] = useState(false);
  const [vFranchigia, setVFranchigia] = useState("0");
  const [vTemporanea, setVTemporanea] = useState(false);
  const [vCaricoScarico, setVCaricoScarico] = useState(false);
  const [vCompetizione, setVCompetizione] = useState(false);
  const [vRimorchio, setVRimorchio] = useState(false);
  const [vCv, setVCv] = useState("0");
  const [vKw, setVKw] = useState("0");
  const [vCc, setVCc] = useState("0");
  const [vPosti, setVPosti] = useState("0");
  const [vPesoMotrice, setVPesoMotrice] = useState("0");
  const [vPesoRimorchio, setVPesoRimorchio] = useState("0");
  const [vPesoTotale, setVPesoTotale] = useState("0");
  const [vTipologiaGuida, setVTipologiaGuida] = useState("");
  const [vTipoAlimentazione, setVTipoAlimentazione] = useState("");
  // Premi garanzia
  const garanzie_default = ["RC", "Furto/Incendio/Eventi", "Tutela Legale", "ARD", "Kasko/Cristalli", "Ass. Stradale", "Infortuni"];
  const [premiGaranzia, setPremiGaranzia] = useState(
    garanzie_default.map((g, i) => ({ garanzia: g, capitale: "", tasso: "", firma: "", rata: "", annuo: "", ordine: i }))
  );
  // Conducente
  const [cNome, setCNome] = useState("");
  const [cCognome, setCCognome] = useState("");
  const [cIndirizzo, setCIndirizzo] = useState("");
  const [cCap, setCCap] = useState("");
  const [cCitta, setCCitta] = useState("");
  const [cProvincia, setCProvincia] = useState("");
  const [cDataNascita, setCDataNascita] = useState("");
  const [cTipoPatente, setCTipoPatente] = useState("");
  const [cDataRilascioPatente, setCDataRilascioPatente] = useState("");
  const [cNote, setCNote] = useState("");

  // Commerciale
  const [selectedCommerciale, setSelectedCommerciale] = useState("__sede__");
  const [percentualeCommerciale, setPercentualeCommerciale] = useState("100");

  // --- Queries ---

  const { data: clienteData } = useQuery({
    queryKey: ["cliente-lookup", codiceCliente],
    queryFn: async () => {
      if (!codiceCliente || codiceCliente.length < 2) return null;
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale, tipo_cliente, gruppo_finanziario_id")
        .or(`codice_fiscale.ilike.%${codiceCliente}%,partita_iva.ilike.%${codiceCliente}%,codice_ricerca.ilike.%${codiceCliente}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: codiceCliente.length >= 2,
  });

  const { data: clienteAE } = useQuery({
    queryKey: ["cliente-ae", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return null;
      const { data } = await supabase
        .from("codici_commerciali_cliente")
        .select("profilo_id, anagrafiche_professionali:profilo_id(id, codice, cognome, nome, sigla)")
        .eq("cliente_id", selectedClienteId)
        .eq("ruolo", "account_executive")
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedClienteId,
  });

  useEffect(() => {
    if (clienteData?.id) setSelectedClienteId(clienteData.id);
  }, [clienteData?.id]);

  useEffect(() => {
    if (clienteAE?.profilo_id) setSelectedAE(clienteAE.profilo_id as string);
  }, [clienteAE?.profilo_id]);

  const { data: aeList } = useQuery({
    queryKey: ["ae-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, codice, cognome, nome, sigla")
        .eq("tipo", "account_executive")
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const { data: commercialiList } = useQuery({
    queryKey: ["commerciali-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo")
        .in("ruolo", ["account_executive", "executive", "produttore_sede", "responsabile_sede"])
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const { data: compagnieList } = useQuery({
    queryKey: ["compagnie-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome, codice").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  const { data: ramiList } = useQuery({
    queryKey: ["rami-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione, gruppo_ramo_id").eq("attivo", true).order("codice");
      return data || [];
    },
  });

  const { data: gruppiRamo } = useQuery({
    queryKey: ["gruppi-ramo-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("gruppi_ramo").select("id, codice, descrizione").eq("attivo", true);
      return data || [];
    },
  });

  const { data: prodottiList } = useQuery({
    queryKey: ["prodotti-list-immissione", selectedCompagnia],
    queryFn: async () => {
      let q = supabase.from("prodotti").select("id, nome_prodotto, codice_prodotto, compagnia_id, categoria_id").eq("attivo", true).order("nome_prodotto");
      if (selectedCompagnia) q = q.eq("compagnia_id", selectedCompagnia);
      const { data } = await q;
      return data || [];
    },
  });

  const selectedProdottoCategoriaId = prodottiList?.find((p) => p.id === selectedProdotto)?.categoria_id as string | undefined;

  // Gruppo ramo del ramo selezionato
  const selectedRamoData = ramiList?.find((r) => r.id === selectedRamo);
  const selectedGruppoRamo = gruppiRamo?.find((g) => g.id === (selectedRamoData as any)?.gruppo_ramo_id);

  const { data: provvigioneDb } = useQuery({
    queryKey: ["provvigione-lookup-ramo", selectedCompagnia, selectedProdottoCategoriaId],
    queryFn: async () => {
      if (!selectedCompagnia || !selectedProdottoCategoriaId) return null;
      const { data } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("id, percentuale_provvigione")
        .eq("compagnia_id", selectedCompagnia)
        .eq("categoria_id", selectedProdottoCategoriaId)
        .eq("attiva", true)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedCompagnia && !!selectedProdottoCategoriaId,
  });

  useEffect(() => {
    if (selectedProdotto && prodottiList) {
      const prod = prodottiList.find((p) => p.id === selectedProdotto);
      if (prod?.compagnia_id && !selectedCompagnia) setSelectedCompagnia(prod.compagnia_id);
    }
  }, [selectedProdotto, prodottiList]);

  useEffect(() => {
    if (provvigioneDb) {
      const val = String(provvigioneDb.percentuale_provvigione ?? "");
      setPercentualeProvvigione(val);
      setProvvigioneOriginalValue(val);
      setProvvigioneFromDb(true);
      setProvvigioneDbRecordId(provvigioneDb.id);
    } else if (selectedCompagnia && selectedProdottoCategoriaId) {
      setPercentualeProvvigione("");
      setProvvigioneOriginalValue("");
      setProvvigioneFromDb(false);
      setProvvigioneDbRecordId(null);
    }
  }, [provvigioneDb, selectedCompagnia, selectedProdottoCategoriaId]);

  const isProvvigioneModified = provvigioneFromDb && percentualeProvvigione !== provvigioneOriginalValue;

  // --- Computed ---
  const totFirma = (parseFloat(premioNetto || "0") + parseFloat(addizionali || "0") + parseFloat(tasse || "0"));
  const totQuietanza = (parseFloat(premioNettoQuietanza || "0") + parseFloat(addizionaliQuietanza || "0") + parseFloat(tasseQuietanza || "0"));
  const provvFirma = percentualeProvvigione ? (parseFloat(premioNetto || "0") * parseFloat(percentualeProvvigione) / 100) : 0;
  const provvQuietanza = percentualeProvvigione ? (parseFloat(premioNettoQuietanza || "0") * parseFloat(percentualeProvvigione) / 100) : 0;

  // --- Handlers ---

  const handleConferma = () => {
    const hasProvvigione = percentualeProvvigione !== "";
    if (hasProvvigione && !provvigioneFromDb) {
      setProvvigioneDialogType("new");
      setShowProvvigioneDialog(true);
      return;
    }
    if (hasProvvigione && isProvvigioneModified) {
      setProvvigioneDialogType("update");
      setShowProvvigioneDialog(true);
      return;
    }
    finalizzaPolizza();
  };

  const handleProvvigioneSave = async () => {
    try {
      if (provvigioneDialogType === "new" && selectedCompagnia && selectedProdottoCategoriaId) {
        await supabase.from("provvigioni_compagnia_ramo").insert({
          compagnia_id: selectedCompagnia,
          categoria_id: selectedProdottoCategoriaId,
          percentuale_provvigione: parseFloat(percentualeProvvigione),
          attiva: true,
        } as any);
        toast.success("Provvigione salvata per questa combinazione Compagnia+Ramo");
      } else {
        if (provvigioneDbRecordId) {
          await supabase.from("provvigioni_compagnia_ramo")
            .update({ percentuale_provvigione: parseFloat(percentualeProvvigione) } as any)
            .eq("id", provvigioneDbRecordId);
          toast.success("Provvigione default aggiornata");
        }
      }
    } catch {
      toast.error("Errore nel salvataggio della provvigione");
    }
    setShowProvvigioneDialog(false);
    finalizzaPolizza();
  };

  const handleProvvigioneSkip = () => {
    setShowProvvigioneDialog(false);
    finalizzaPolizza();
  };

  const finalizzaPolizza = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        numero_titolo: numeroPolizza || null,
        riga: parseInt(riga) || 0,
        appendice: appendice || "000",
        compagnia_id: selectedCompagnia || null,
        ramo_id: selectedRamo || null,
        prodotto_id: selectedProdotto || null,
        cliente_anagrafica_id: selectedClienteId || null,
        specialist: specialist || null,
        tipo_portafoglio: tipoPortafoglio,
        cig_rif: cigRif || null,
        vincolo: vincolo || null,
        targa_telaio: targaTelaio || null,
        descrizione_polizza: descrizionePolizza || null,
        durata_da: durataDa || null,
        durata_a: durataA || null,
        anni_durata: parseInt(anniDurata) || 1,
        tipo_rinnovo: tipoRinnovo,
        periodicita,
        rate: parseInt(rate) || 1,
        mora_giorni: parseInt(moraGiorni) || 15,
        premio_netto: premioNetto ? parseFloat(premioNetto) : null,
        addizionali: addizionali ? parseFloat(addizionali) : 0,
        tasse: tasse ? parseFloat(tasse) : null,
        premio_lordo: totFirma || null,
        valuta,
        provvigioni_firma: provvFirma || null,
        percentuale_provvigione: percentualeProvvigione ? parseFloat(percentualeProvvigione) : null,
        commerciale_id: selectedCommerciale === "__sede__" ? null : selectedCommerciale,
        percentuale_commerciale: parseFloat(percentualeCommerciale) || 100,
        garanzia_da: garanziaDa || null,
        garanzia_a: garanziaA || null,
        data_competenza: dataCompetenza || null,
        limite_mora: limiteMora || null,
        disdetta_mesi: disdettaMesi ? parseInt(disdettaMesi) : null,
        regolazione,
        tipo_lettera_regolazione: tipoLetteraRegolazione || null,
        tipo_scadenza: tipoScadenza,
        giorni_presentazione: giorniPresentazione ? parseInt(giorniPresentazione) : null,
        libro_matricola: libroMatricola,
        premio_netto_quietanza: premioNettoQuietanza ? parseFloat(premioNettoQuietanza) : null,
        addizionali_quietanza: addizionaliQuietanza ? parseFloat(addizionaliQuietanza) : null,
        tasse_quietanza: tasseQuietanza ? parseFloat(tasseQuietanza) : null,
        provvigioni_quietanza: provvQuietanza || null,
        rimborso, indicizzata, no_calcolo_tasse: noCalcoloTasse,
        pag_diretto_compagnia: pagDirettoCompagnia, emissione_fee: emissioneFee,
        formato_elettronico: formatoElettronico, fax_incasso: faxIncasso === "si",
        cambio: parseFloat(cambio) || 1,
        copertura_da: coperturaDa || null, copertura_numero: coperturaNumero || null,
        data_incasso: dataIncasso || null, numero_incasso: numeroIncasso || null,
        stato: "creato",
        ufficio_id: profile?.ufficio_id || null,
      };

      const { data: newTitolo, error } = await supabase
        .from("titoli")
        .insert(payload as any)
        .select("id")
        .single();
      if (error) throw error;

      // Create first movimento "Polizza Base"
      await supabase.from("movimenti_polizza").insert({
        titolo_id: newTitolo.id,
        riga: parseInt(riga) || 0,
        appendice: appendice || "000",
        data_movimento: new Date().toISOString().split("T")[0],
        data_effetto: durataDa || null,
        data_scadenza: durataA || null,
        tipo_rinnovo: tipoRinnovo === "tacito_rinnovo" ? "Tacito rinnovo" : tipoRinnovo,
        descrizione: cigRif ? `CIG: ${cigRif}` : descrizionePolizza || null,
        valuta,
        premio: totFirma || 0,
        provvigioni: provvFirma || 0,
        tipo: "Polizza Base",
        incassato: false,
        stato: "attivo",
        ufficio_id: profile?.ufficio_id || null,
      } as any);

      toast.success("Polizza registrata con successo");
      navigate(`/titoli/${newTitolo.id}`);
    } catch (err: any) {
      console.error("Errore salvataggio polizza:", err);
      toast.error(err.message || "Errore nel salvataggio della polizza");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Immissione Polizza</h1>
        <p className="text-sm text-muted-foreground mt-1">Inserimento nuova polizza nel portafoglio</p>
      </div>

      {/* CLIENTE */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Cliente</legend>
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 flex-1 max-w-[200px]">
            <Label htmlFor="codice-cliente" className="text-xs">Codice / CF / P.IVA</Label>
            <div className="relative">
              <Input id="codice-cliente" value={codiceCliente} onChange={(e) => setCodiceCliente(e.target.value)} placeholder="Cerca cliente" className="h-8 text-xs" />
              <Search className="absolute right-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          {clienteData && (
            <p className="text-sm text-foreground pb-1 font-medium">
              {clienteData.ragione_sociale || `${clienteData.cognome} ${clienteData.nome}`}
            </p>
          )}
        </div>
        <div className="space-y-1.5 max-w-[300px]">
          <Label className="text-xs">A/E (ereditato dal cliente)</Label>
          <SearchableSelect
            className="h-8 text-xs"
            value={selectedAE}
            onValueChange={setSelectedAE}
            placeholder="— Seleziona A/E —"
            options={(aeList || []).map((ae) => ({
              value: ae.id,
              label: `${ae.sigla || ae.codice} - ${ae.cognome} ${ae.nome}`,
            }))}
          />
        </div>
      </fieldset>

      {/* CONTRATTO */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Contratto</legend>

        <AiDocumentScanner
          documentType="copia_polizza"
          onFileReady={(file) => { scannedFileRef.current = file; }}
          onExtracted={(data) => {
            if (data.numero_polizza) setNumeroPolizza(data.numero_polizza as string);
          }}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Compagnia</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedCompagnia}
              onValueChange={setSelectedCompagnia}
              placeholder="— Compagnia —"
              options={(compagnieList || []).map((c) => ({ value: c.id, label: `${c.codice || ""} - ${c.nome}` }))}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Ramo</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SearchableSelect
                  className="h-8 text-xs"
                  value={selectedRamo}
                  onValueChange={setSelectedRamo}
                  placeholder="— Ramo —"
                  options={(ramiList || []).map((r) => ({ value: r.id, label: `${r.codice} - ${r.descrizione}` }))}
                />
              </div>
              {selectedGruppoRamo && (
                <Badge variant="secondary" className="text-[10px] whitespace-nowrap shrink-0">
                  {selectedGruppoRamo.descrizione}
                </Badge>
              )}
            </div>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Prodotto</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedProdotto}
              onValueChange={setSelectedProdotto}
              placeholder="— Prodotto —"
              options={(prodottiList || []).map((p) => ({ value: p.id, label: `${p.codice_prodotto || ""} - ${p.nome_prodotto}` }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Backoffice</Label>
            <SearchableSelect className="h-8 text-xs" value={specialist} onValueChange={setSpecialist} placeholder="—"
              options={[{ value: "danni", label: "Danni" }, { value: "vita", label: "Vita" }, { value: "auto", label: "Auto" }, { value: "re", label: "RE" }]}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo Portafoglio</Label>
            <SearchableSelect className="h-8 text-xs" value={tipoPortafoglio} onValueChange={setTipoPortafoglio} placeholder="—"
              options={[{ value: "diretto", label: "Diretto" }, { value: "indiretto", label: "Indiretto" }, { value: "ri", label: "Riassicurazione" }]}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">N° Polizza</Label>
            <div className="relative">
              <Input value={numeroPolizza} onChange={(e) => setNumeroPolizza(e.target.value)} placeholder="N° polizza" className="h-8 text-xs" />
              <Search className="absolute right-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Riga</Label>
            <Input value={riga} onChange={(e) => setRiga(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Appendice</Label>
            <Input value={appendice} onChange={(e) => setAppendice(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Targa/Telaio</Label>
            <Input value={targaTelaio} onChange={(e) => setTargaTelaio(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">CIG/Rif.</Label>
            <Input value={cigRif} onChange={(e) => setCigRif(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vincolo</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={vincolo}
              onValueChange={setVincolo}
              placeholder="— Specificare vincolo —"
              options={[
                { value: "nessuno", label: "Nessuno" },
                { value: "ipoteca", label: "Ipoteca" },
                { value: "leasing", label: "Leasing" },
                { value: "pegno", label: "Pegno" },
                { value: "cessione", label: "Cessione" },
                { value: "altro", label: "Altro" },
              ]}
            />
          </div>
        </div>
      </fieldset>

      {/* PERIODO */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Periodo</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Durata Da</Label>
            <Input type="date" value={durataDa} onChange={(e) => setDurataDa(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Durata A</Label>
            <Input type="date" value={durataA} onChange={(e) => setDurataA(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Anni Durata</Label>
            <Input type="number" value={anniDurata} onChange={(e) => setAnniDurata(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Rate</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Garanzia Da</Label>
            <Input type="date" value={garanziaDa} onChange={(e) => setGaranziaDa(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Garanzia A</Label>
            <Input type="date" value={garanziaA} onChange={(e) => setGaranziaA(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data Competenza</Label>
            <Input type="date" value={dataCompetenza} onChange={(e) => setDataCompetenza(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Limite Mora</Label>
            <Input type="date" value={limiteMora} onChange={(e) => setLimiteMora(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo Rinnovo</Label>
            <SearchableSelect className="h-8 text-xs" value={tipoRinnovo} onValueChange={setTipoRinnovo} placeholder="—"
              options={[
                { value: "tacito_rinnovo", label: "Tacito Rinnovo" },
                { value: "scadenza_naturale", label: "Scadenza Naturale" },
                { value: "libera", label: "Libera" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GG Mora</Label>
            <Input type="number" value={moraGiorni} onChange={(e) => setMoraGiorni(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Disdetta (mesi)</Label>
            <Input type="number" value={disdettaMesi} onChange={(e) => setDisdettaMesi(e.target.value)} placeholder="0" className="h-8 text-xs" />
          </div>
        </div>
      </fieldset>

      {/* REGOLAZIONE */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Regolazione</legend>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div className="flex items-center gap-2 h-8">
            <Checkbox id="regolazione" checked={regolazione} onCheckedChange={(v) => setRegolazione(v === true)} />
            <Label htmlFor="regolazione" className="font-normal cursor-pointer text-xs">Regolazione Sì</Label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Periodicità</Label>
            <SearchableSelect className="h-8 text-xs" value={periodicita} onValueChange={setPeriodicita} placeholder="—"
              options={[
                { value: "annuale", label: "Annuale" },
                { value: "semestrale", label: "Semestrale" },
                { value: "trimestrale", label: "Trimestrale" },
                { value: "mensile", label: "Mensile" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo Scadenza</Label>
            <SearchableSelect className="h-8 text-xs" value={tipoScadenza} onValueChange={setTipoScadenza} placeholder="—"
              options={[
                { value: "no_scadenza", label: "No Scadenza" },
                { value: "a_scadenza", label: "A Scadenza" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GG Presentazione</Label>
            <Input type="number" value={giorniPresentazione} onChange={(e) => setGiorniPresentazione(e.target.value)} placeholder="0" className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo Lettera Regolazione</Label>
            <SearchableSelect className="h-8 text-xs" value={tipoLetteraRegolazione} onValueChange={setTipoLetteraRegolazione} placeholder="— Tipo lettera —"
              options={[
                { value: "standard", label: "Standard" },
                { value: "personalizzata", label: "Personalizzata" },
                { value: "nessuna", label: "Nessuna" },
              ]}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs">Libro Matricola</Label>
            <RadioGroup value={libroMatricola} onValueChange={setLibroMatricola} className="flex gap-4 h-8 items-center">
              {[
                { value: "no", label: "No" },
                { value: "auto", label: "Auto" },
                { value: "altro", label: "Altro" },
              ].map((opt) => (
                <div key={opt.value} className="flex items-center gap-1.5">
                  <RadioGroupItem value={opt.value} id={`lm-${opt.value}`} />
                  <Label htmlFor={`lm-${opt.value}`} className="font-normal cursor-pointer text-xs">{opt.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        </div>
      </fieldset>

      {/* IMPORTI */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Importi</legend>

        {/* Tabella Firma / Quietanza */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground w-24"></th>
                <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Netto €</th>
                <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Addizionali €</th>
                <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Tasse €</th>
                <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Totale €</th>
                <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Provvigioni €</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 font-semibold text-foreground">Firma</td>
                <td className="py-1 px-1">
                  <Input type="number" step="0.01" value={premioNetto} onChange={(e) => setPremioNetto(e.target.value)} className="h-7 text-xs font-mono text-right" />
                </td>
                <td className="py-1 px-1">
                  <Input type="number" step="0.01" value={addizionali} onChange={(e) => setAddizionali(e.target.value)} className="h-7 text-xs font-mono text-right" />
                </td>
                <td className="py-1 px-1">
                  <Input type="number" step="0.01" value={tasse} onChange={(e) => setTasse(e.target.value)} className="h-7 text-xs font-mono text-right" />
                </td>
                <td className="py-1.5 px-2 text-right font-mono font-semibold text-foreground">{totFirma.toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right font-mono text-foreground">{provvFirma.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="py-1.5 px-2 font-semibold text-foreground">Pros. Quietanza</td>
                <td className="py-1 px-1">
                  <Input type="number" step="0.01" value={premioNettoQuietanza} onChange={(e) => setPremioNettoQuietanza(e.target.value)} className="h-7 text-xs font-mono text-right" />
                </td>
                <td className="py-1 px-1">
                  <Input type="number" step="0.01" value={addizionaliQuietanza} onChange={(e) => setAddizionaliQuietanza(e.target.value)} className="h-7 text-xs font-mono text-right" />
                </td>
                <td className="py-1 px-1">
                  <Input type="number" step="0.01" value={tasseQuietanza} onChange={(e) => setTasseQuietanza(e.target.value)} className="h-7 text-xs font-mono text-right" />
                </td>
                <td className="py-1.5 px-2 text-right font-mono font-semibold text-foreground">{totQuietanza.toFixed(2)}</td>
                <td className="py-1.5 px-2 text-right font-mono text-foreground">{provvQuietanza.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Flags row */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
          {[
            { id: "rimborso", label: "Rimborso", checked: rimborso, onChange: setRimborso },
            { id: "indicizzata", label: "Indicizzata", checked: indicizzata, onChange: setIndicizzata },
            { id: "noCalcoloTasse", label: "No Calcolo Tasse", checked: noCalcoloTasse, onChange: setNoCalcoloTasse },
            { id: "pagDiretto", label: "Pag. Diretto Compagnia", checked: pagDirettoCompagnia, onChange: setPagDirettoCompagnia },
            { id: "emissioneFee", label: "Emissione Fee", checked: emissioneFee, onChange: setEmissioneFee },
            { id: "formatoElett", label: "Formato Elettronico", checked: formatoElettronico, onChange: setFormatoElettronico },
          ].map((flag) => (
            <div key={flag.id} className="flex items-center gap-1.5">
              <Checkbox id={flag.id} checked={flag.checked} onCheckedChange={(v) => flag.onChange(v === true)} />
              <Label htmlFor={flag.id} className="font-normal cursor-pointer text-xs">{flag.label}</Label>
            </div>
          ))}
        </div>

        {/* Additional fields */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Fax Incasso</Label>
            <RadioGroup value={faxIncasso} onValueChange={setFaxIncasso} className="flex gap-3 h-8 items-center">
              <div className="flex items-center gap-1"><RadioGroupItem value="si" id="fax-si" /><Label htmlFor="fax-si" className="text-xs font-normal cursor-pointer">Sì</Label></div>
              <div className="flex items-center gap-1"><RadioGroupItem value="no" id="fax-no" /><Label htmlFor="fax-no" className="text-xs font-normal cursor-pointer">No</Label></div>
            </RadioGroup>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cambio</Label>
            <Input type="number" step="0.0001" value={cambio} onChange={(e) => setCambio(e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valuta</Label>
            <SearchableSelect className="h-8 text-xs" value={valuta} onValueChange={setValuta} placeholder="—"
              options={[{ value: "EUR", label: "EUR" }, { value: "USD", label: "USD" }, { value: "GBP", label: "GBP" }]}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Copertura Da</Label>
            <Input type="date" value={coperturaDa} onChange={(e) => setCoperturaDa(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Copertura N°</Label>
            <Input value={coperturaNumero} onChange={(e) => setCoperturaNumero(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data Incasso</Label>
            <Input type="date" value={dataIncasso} onChange={(e) => setDataIncasso(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">N° Incasso</Label>
            <Input value={numeroIncasso} onChange={(e) => setNumeroIncasso(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </fieldset>

      {/* PROVVIGIONI */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Provvigioni</legend>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">% Provvigione Agenzia</Label>
            <Input
              type="number" step="0.01" min="0" max="100"
              value={percentualeProvvigione}
              onChange={(e) => setPercentualeProvvigione(e.target.value)}
              placeholder={selectedCompagnia && selectedProdottoCategoriaId ? "Inserisci %" : "Seleziona compagnia e prodotto"}
              disabled={!selectedCompagnia || !selectedProdottoCategoriaId}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            {selectedProdottoCategoriaId && provvigioneFromDb && !isProvvigioneModified && (
              <Badge className="bg-green-100 text-green-800 border-green-300 text-[10px]">Da database (Compagnia+Ramo)</Badge>
            )}
            {selectedProdottoCategoriaId && provvigioneFromDb && isProvvigioneModified && (
              <Badge className="bg-orange-100 text-orange-800 border-orange-300 text-[10px]">Modificato (era {provvigioneOriginalValue}%)</Badge>
            )}
            {selectedProdottoCategoriaId && !provvigioneFromDb && percentualeProvvigione && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">Nuovo valore</Badge>
            )}
            {selectedCompagnia && selectedProdottoCategoriaId && !provvigioneFromDb && !percentualeProvvigione && (
              <span className="text-[10px] text-muted-foreground">Nessuna provvigione per questa combinazione</span>
            )}
          </div>
          {premioNetto && percentualeProvvigione && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Importo Provv. Agenzia</Label>
              <p className="text-sm font-mono font-semibold text-foreground">
                € {((parseFloat(premioNetto) * parseFloat(percentualeProvvigione)) / 100).toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Commerciale */}
        <div className="border-t border-border pt-4 mt-2">
          <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Ripartizione Commerciale</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Commerciale</Label>
              <SearchableSelect
                className="h-8 text-xs"
                value={selectedCommerciale}
                onValueChange={(v) => {
                  setSelectedCommerciale(v);
                  if (v === "__sede__") setPercentualeCommerciale("100");
                }}
                placeholder="— Seleziona —"
                options={[
                  { value: "__sede__", label: "🏢 Sede (100%)" },
                  ...(commercialiList || []).map((c) => ({
                    value: c.id,
                    label: `${c.cognome} ${c.nome} (${c.ruolo})`,
                  })),
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">% Commerciale</Label>
              <Input
                type="number" step="1" min="0" max="100"
                value={percentualeCommerciale}
                onChange={(e) => setPercentualeCommerciale(e.target.value)}
                disabled={selectedCommerciale === "__sede__"}
                className="h-8 text-xs font-mono"
              />
            </div>
            {premioNetto && percentualeProvvigione && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Split</Label>
                <div className="text-[11px] font-mono space-y-0.5">
                  <p className="text-foreground">
                    Comm: € {((parseFloat(premioNetto) * parseFloat(percentualeProvvigione) / 100) * parseFloat(percentualeCommerciale || "0") / 100).toFixed(2)}
                  </p>
                  <p className="text-primary font-semibold">
                    Sede: € {((parseFloat(premioNetto) * parseFloat(percentualeProvvigione) / 100) * (100 - parseFloat(percentualeCommerciale || "0")) / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </fieldset>

      {/* TIPO */}
      <fieldset className="border border-border rounded-lg p-5 space-y-4">
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Tipo</legend>
        <div className="space-y-3">
          <Label className="text-xs">Tipo Operazione</Label>
          <RadioGroup value={tipoOperazione} onValueChange={setTipoOperazione} className="flex flex-wrap gap-4">
            {[
              { value: "polizza", label: "Polizza" },
              { value: "emittenda", label: "Emittenda" },
              { value: "cp_nuova", label: "CP (Nuova)" },
              { value: "cp_sost_rinn", label: "CP (Sost/Rinn)" },
            ].map((opt) => (
              <div key={opt.value} className="flex items-center gap-2">
                <RadioGroupItem value={opt.value} id={`tipo-${opt.value}`} />
                <Label htmlFor={`tipo-${opt.value}`} className="font-normal cursor-pointer text-xs">{opt.label}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Checkbox id="polizza-auto" checked={polizzaAuto} onCheckedChange={(v) => setPolizzaAuto(v === true)} />
          <Label htmlFor="polizza-auto" className="font-normal cursor-pointer text-xs">Polizza Auto</Label>
        </div>
      </fieldset>

      {/* ACTIONS */}
      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => navigate("/portafoglio/gestione-polizze")}>Chiudi</Button>
        <Button onClick={handleConferma} disabled={saving}>{saving ? "Salvataggio..." : "Conferma"}</Button>
      </div>

      {/* DIALOG PROVVIGIONI */}
      <AlertDialog open={showProvvigioneDialog} onOpenChange={setShowProvvigioneDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {provvigioneDialogType === "new" ? "Salvare provvigione come default?" : "Aggiornare provvigione default?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {provvigioneDialogType === "new"
                ? `Non esiste una provvigione per questa combinazione Compagnia+Ramo. Vuoi salvare ${percentualeProvvigione}% come valore predefinito?`
                : `La provvigione è cambiata da ${provvigioneOriginalValue}% a ${percentualeProvvigione}%. Vuoi aggiornare il valore predefinito?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleProvvigioneSkip}>No, solo per questa polizza</AlertDialogCancel>
            <AlertDialogAction onClick={handleProvvigioneSave}>Sì, salva come default</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ImmissionePolizzaPage;
