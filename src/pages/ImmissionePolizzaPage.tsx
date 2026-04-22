import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import { CLASSI_MERITO, TIPI_VEICOLO } from "@/lib/rcaConstants";
import { MarcaCombobox, ModelloCombobox } from "@/components/rca/MarcaModelloCombobox";
import { useRcaSettori, useRcaUsi } from "@/hooks/useRcaLookups";
import { QuickClienteDialog } from "@/components/polizze/QuickClienteDialog";

const ImmissionePolizzaPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClienteId = searchParams.get("clienteId");
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);

  // Form state — Cliente
  const [codiceCliente, setCodiceCliente] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [selectedAE, setSelectedAE] = useState("");
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [selectedUfficioId, setSelectedUfficioId] = useState("");
  const [selectedBackofficeId, setSelectedBackofficeId] = useState("");

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
  const [prodottoNome, setProdottoNome] = useState("");
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
  const [tacitoRinnovo, setTacitoRinnovo] = useState(true);
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

  // Provvigioni: l'utente inserisce manualmente la percentuale (lookup automatica rimossa)
  const [percentualeProvvigione, setPercentualeProvvigione] = useState("");

  // === RCA AUTO State ===
  // Veicolo
  const [vSettore, setVSettore] = useState("Autovetture");
  const [vSettoreId, setVSettoreId] = useState("");
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

  // RCA lookup hooks
  const { data: rcaSettori } = useRcaSettori();
  const { data: rcaUsi } = useRcaUsi(vSettoreId);
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

  // Ricerca server-side per il SearchableSelect cliente
  const { data: clientiSearchResults } = useQuery({
    queryKey: ["clienti-search-immissione", clienteSearch],
    queryFn: async () => {
      let q = supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, tipo_cliente, ufficio_id")
        .eq("attivo", true)
        .order("ragione_sociale", { nullsFirst: false })
        .limit(50);
      if (clienteSearch && clienteSearch.length >= 2) {
        const term = `%${clienteSearch}%`;
        q = q.or(
          `ragione_sociale.ilike.${term},cognome.ilike.${term},nome.ilike.${term},codice_fiscale.ilike.${term},partita_iva.ilike.${term}`
        );
      }
      const { data } = await q;
      return data || [];
    },
    staleTime: 1000 * 30,
  });

  // Dettaglio cliente selezionato (per eredità ufficio)
  const { data: clienteDettaglio } = useQuery({
    queryKey: ["cliente-dettaglio-immissione", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return null;
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, ufficio_id, gruppo_finanziario_id")
        .eq("id", selectedClienteId)
        .maybeSingle();
      return data;
    },
    enabled: !!selectedClienteId,
  });

  const { data: clienteAE } = useQuery({
    queryKey: ["cliente-ae-bo", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return [];
      const { data } = await supabase
        .from("codici_commerciali_cliente")
        .select("profilo_id, ruolo")
        .eq("cliente_id", selectedClienteId)
        .in("ruolo", ["account_executive", "AE", "Backoffice"]);
      return data || [];
    },
    enabled: !!selectedClienteId,
  });

  useEffect(() => {
    if (clienteData?.id) setSelectedClienteId(clienteData.id);
  }, [clienteData?.id]);

  // Pre-selezione cliente da query string (es. da scheda cliente)
  useEffect(() => {
    if (preselectedClienteId && !selectedClienteId) {
      setSelectedClienteId(preselectedClienteId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedClienteId]);

  // Eredita ufficio dal cliente
  useEffect(() => {
    if (clienteDettaglio?.ufficio_id) {
      setSelectedUfficioId(clienteDettaglio.ufficio_id);
    }
  }, [clienteDettaglio?.ufficio_id]);

  // Eredita AE e Backoffice dal cliente
  useEffect(() => {
    if (Array.isArray(clienteAE) && clienteAE.length > 0) {
      const ae = clienteAE.find((c: any) => c.ruolo === "account_executive" || c.ruolo === "AE");
      const bo = clienteAE.find((c: any) => c.ruolo === "Backoffice");
      if (ae?.profilo_id) setSelectedAE(ae.profilo_id as string);
      if (bo?.profilo_id) setSelectedBackofficeId(bo.profilo_id as string);
    }
  }, [clienteAE]);

  // Default ufficio = ufficio dell'utente loggato
  useEffect(() => {
    if (profile?.ufficio_id && !selectedUfficioId) {
      setSelectedUfficioId(profile.ufficio_id);
    }
  }, [profile?.ufficio_id]);

  const { data: aeList } = useQuery({
    queryKey: ["produttori-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, codice, cognome, nome, sigla, ragione_sociale, tipo")
        .in("tipo", ["account_executive", "corrispondente", "responsabile_sede"])
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const { data: backofficeList } = useQuery({
    queryKey: ["backoffice-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, cognome, ruolo")
        .eq("ruolo", "backoffice")
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
  });

  const { data: ufficiList } = useQuery({
    queryKey: ["uffici-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase
        .from("uffici")
        .select("id, nome_ufficio, codice_ufficio")
        .eq("attivo", true)
        .order("nome_ufficio");
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

  // Gruppo ramo del ramo selezionato
  const selectedRamoData = ramiList?.find((r) => r.id === selectedRamo);
  const selectedGruppoRamo = gruppiRamo?.find((g) => g.id === (selectedRamoData as any)?.gruppo_ramo_id);

  // Detect RCA: gruppo ramo contiene "RCA" o "Auto" oppure checkbox polizzaAuto
  const isRCA = polizzaAuto || (selectedGruppoRamo?.descrizione || "").toUpperCase().includes("RCA") || (selectedGruppoRamo?.descrizione || "").toUpperCase().includes("AUTO");

  // Provvigione: rimossa lookup automatica per prodotto (prodotto è ora testo libero).
  // L'utente inserisce manualmente la percentuale.
  const provvigioneFromDb = false;
  const isProvvigioneModified = false;

  // --- Computed ---
  const totFirma = (parseFloat(premioNetto || "0") + parseFloat(addizionali || "0") + parseFloat(tasse || "0"));
  const totQuietanza = (parseFloat(premioNettoQuietanza || "0") + parseFloat(addizionaliQuietanza || "0") + parseFloat(tasseQuietanza || "0"));
  const provvFirma = percentualeProvvigione ? (parseFloat(premioNetto || "0") * parseFloat(percentualeProvvigione) / 100) : 0;
  const provvQuietanza = percentualeProvvigione ? (parseFloat(premioNettoQuietanza || "0") * parseFloat(percentualeProvvigione) / 100) : 0;

  // --- Handlers ---

  const handleConferma = () => {
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
        prodotto_nome: prodottoNome || null,
        cliente_anagrafica_id: selectedClienteId || null,
        tipo_portafoglio: tipoPortafoglio,
        cig_rif: cigRif || null,
        vincolo: vincolo || null,
        targa_telaio: targaTelaio || null,
        descrizione_polizza: descrizionePolizza || null,
        durata_da: durataDa || null,
        durata_a: durataA || null,
        anni_durata: parseInt(anniDurata) || 1,
        tacito_rinnovo: tacitoRinnovo,
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
        ufficio_id: selectedUfficioId || profile?.ufficio_id || null,
        // Produttore: salviamo il nome leggibile in produttore_nome (text).
        // produttore_id resta NULL/legacy.
        produttore_nome: (() => {
          if (!selectedAE) return null;
          const ae = (aeList || []).find((a: any) => a.id === selectedAE);
          if (!ae) return null;
          return (ae as any).ragione_sociale || `${(ae as any).cognome || ""} ${(ae as any).nome || ""}`.trim() || null;
        })(),
        // Backoffice (Specialist) salvato come "COGNOME NOME" leggibile in titoli.specialist
        ...(selectedBackofficeId ? {
          specialist: (() => {
            const b = (backofficeList || []).find((x: any) => x.id === selectedBackofficeId);
            return b ? `${(b as any).cognome || ""} ${(b as any).nome || ""}`.trim() : null;
          })(),
        } : {}),
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
        tacito_rinnovo: tacitoRinnovo,
        descrizione: cigRif ? `CIG: ${cigRif}` : descrizionePolizza || null,
        valuta,
        premio: totFirma || 0,
        provvigioni: provvFirma || 0,
        tipo: "Polizza Base",
        incassato: false,
        stato: "attivo",
        ufficio_id: selectedUfficioId || profile?.ufficio_id || null,
      } as any);

      // Save RCA data if applicable
      if (isRCA) {
        await supabase.from("veicoli_polizza").insert({
          titolo_id: newTitolo.id,
          settore: vSettore || null, tipo_veicolo: vTipoVeicolo || null, uso: vUso || null,
          marca: vMarca || null, modello: vModello || null, versione: vVersione || null,
          targa: vTarga || null, telaio: vTelaio || null, veicolo_descrizione: vDescrizione || null,
          data_immatricolazione: vDataImmatricolazione || null,
          anno_acquisto: vAnnoAcquisto ? parseInt(vAnnoAcquisto) : null,
          provincia_circolazione: vProvinciaCircolazione || null,
          classe_bm: vClasseBm || null,
          massimale_1: parseFloat(vMass1) || 0, massimale_2: parseFloat(vMass2) || 0, massimale_3: parseFloat(vMass3) || 0,
          peius: vPeius, franchigia: parseFloat(vFranchigia) || 0,
          temporanea: vTemporanea, carico_scarico: vCaricoScarico, competizione: vCompetizione, rimorchio: vRimorchio,
          cv: parseInt(vCv) || 0, kw: parseInt(vKw) || 0, cc: parseInt(vCc) || 0, posti: parseInt(vPosti) || 0,
          peso_motrice: parseInt(vPesoMotrice) || 0, peso_rimorchio: parseInt(vPesoRimorchio) || 0, peso_totale: parseInt(vPesoTotale) || 0,
          tipologia_guida: vTipologiaGuida || null, tipo_alimentazione: vTipoAlimentazione || null,
        } as any);

        // Premi garanzia
        const premiRows = premiGaranzia.filter(p => parseFloat(p.firma || "0") > 0 || parseFloat(p.rata || "0") > 0 || parseFloat(p.annuo || "0") > 0);
        if (premiRows.length > 0) {
          await supabase.from("premi_garanzia_polizza").insert(
            premiRows.map(p => ({
              titolo_id: newTitolo.id,
              garanzia: p.garanzia,
              capitale: parseFloat(p.capitale || "0"),
              tasso: parseFloat(p.tasso || "0"),
              firma: parseFloat(p.firma || "0"),
              rata: parseFloat(p.rata || "0"),
              annuo: parseFloat(p.annuo || "0"),
              ordine: p.ordine,
            })) as any
          );
        }

        // Conducente
        if (cNome || cCognome) {
          await supabase.from("conducenti_polizza").insert({
            titolo_id: newTitolo.id,
            nome: cNome || null, cognome: cCognome || null,
            indirizzo: cIndirizzo || null, cap: cCap || null, citta: cCitta || null, provincia: cProvincia || null,
            data_nascita: cDataNascita || null, tipo_patente: cTipoPatente || null,
            data_rilascio_patente: cDataRilascioPatente || null, note: cNote || null,
          } as any);
        }
      }

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
        <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">Cliente & Sede</legend>

        {/* Selezione cliente esistente */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente esistente</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedClienteId}
              onValueChange={(v) => setSelectedClienteId(v)}
              placeholder="— Cerca cliente per nome, CF o P.IVA —"
              emptyText={clienteSearch.length < 2 ? "Digita almeno 2 caratteri" : "Nessun cliente trovato"}
              options={(clientiSearchResults || []).map((c: any) => ({
                value: c.id,
                label: c.ragione_sociale
                  ? `${c.ragione_sociale}${c.partita_iva ? ` — P.IVA ${c.partita_iva}` : ""}`
                  : `${c.cognome || ""} ${c.nome || ""}${c.codice_fiscale ? ` — CF ${c.codice_fiscale}` : ""}`.trim(),
              }))}
            />
          </div>
          <QuickClienteDialog
            onCreated={(id, label) => {
              setSelectedClienteId(id);
              setClienteSearch(label);
            }}
          />
        </div>

        {/* Lookup veloce per codice/CF (legacy) */}
        <div className="flex items-end gap-3">
          <div className="space-y-1.5 flex-1 max-w-[260px]">
            <Label htmlFor="codice-cliente" className="text-xs">Lookup rapido (Codice / CF / P.IVA)</Label>
            <div className="relative">
              <Input id="codice-cliente" value={codiceCliente} onChange={(e) => setCodiceCliente(e.target.value)} placeholder="es. RSSMRA80A01..." className="h-8 text-xs" />
              <Search className="absolute right-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
          {clienteDettaglio && (
            <p className="text-sm text-foreground pb-1 font-medium">
              ✓ {clienteDettaglio.ragione_sociale || `${clienteDettaglio.cognome || ""} ${clienteDettaglio.nome || ""}`.trim()}
            </p>
          )}
        </div>

        {/* Ufficio (Sede) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Sede (Ufficio) *</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedUfficioId}
              onValueChange={setSelectedUfficioId}
              placeholder="— Seleziona sede —"
              options={(ufficiList || []).map((u: any) => ({
                value: u.id,
                label: `${u.codice_ufficio ? u.codice_ufficio + " - " : ""}${u.nome_ufficio}`,
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Produttore</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedAE}
              onValueChange={setSelectedAE}
              placeholder="— Seleziona produttore —"
              options={(aeList || []).map((ae: any) => ({
                value: ae.id,
                label: ae.ragione_sociale || `${ae.sigla || ae.codice || ""} - ${ae.cognome || ""} ${ae.nome || ""}`.trim(),
              }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Specialist</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedBackofficeId}
              onValueChange={setSelectedBackofficeId}
              placeholder="— Seleziona Specialist —"
              options={(backofficeList || []).map((b: any) => ({
                value: b.id,
                label: `${b.cognome || ""} ${b.nome || ""}`.trim(),
              }))}
            />
          </div>
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
            <Input
              type="text"
              className="h-8 text-xs"
              placeholder="Nome prodotto (testo libero)"
              value={prodottoNome}
              onChange={(e) => setProdottoNome(e.target.value)}
            />
          </div>
          {/* Campo Specialist hardcoded rimosso: lo Specialist è ora unico (sezione Sede), salvato come nome leggibile in titoli.specialist */}
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
            <Label className="text-xs">Tacito Rinnovo</Label>
            <div className="flex items-center gap-2 h-8">
              <Switch checked={tacitoRinnovo} onCheckedChange={setTacitoRinnovo} />
              <span className="text-xs text-muted-foreground">{tacitoRinnovo ? "Sì" : "No"}</span>
            </div>
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
              placeholder={selectedCompagnia ? "Inserisci %" : "Seleziona compagnia"}
              disabled={!selectedCompagnia}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="flex items-center gap-2 pb-1">
            {!selectedCompagnia && (
              <span className="text-[10px] text-muted-foreground">Seleziona una compagnia</span>
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

      {/* === SEZIONI RCA AUTO === */}
      {isRCA && (
        <>
          {/* DATI VEICOLO */}
          <fieldset className="border border-border rounded-lg p-5 space-y-4 border-l-4 border-l-primary">
            <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">🚗 Dati Veicolo</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Settore</Label>
                <SearchableSelect className="h-8 text-xs" value={vSettoreId} onValueChange={(v) => { setVSettoreId(v); setVUso(""); const s = rcaSettori?.find(s => s.value === v); if (s) setVSettore(s.descrizione); }} placeholder="—"
                  options={rcaSettori || []} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo Veicolo</Label>
                <SearchableSelect className="h-8 text-xs" value={vTipoVeicolo} onValueChange={setVTipoVeicolo} placeholder="—"
                  options={TIPI_VEICOLO} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Uso</Label>
                <SearchableSelect className="h-8 text-xs" value={vUso} onValueChange={setVUso} placeholder="—"
                  options={rcaUsi || []} disabled={!vSettoreId} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Provincia Circolazione</Label>
                <Input value={vProvinciaCircolazione} onChange={(e) => setVProvinciaCircolazione(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Marca</Label>
                <MarcaCombobox className="h-8 text-xs" value={vMarca} onValueChange={(v) => { setVMarca(v); setVModello(""); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Modello</Label>
                <ModelloCombobox className="h-8 text-xs" marca={vMarca} value={vModello} onValueChange={setVModello} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Versione</Label>
                <Input value={vVersione} onChange={(e) => setVVersione(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Targa</Label>
                <Input value={vTarga} onChange={(e) => setVTarga(e.target.value.toUpperCase())} className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Veicolo (descrizione)</Label>
                <Input value={vDescrizione} onChange={(e) => setVDescrizione(e.target.value)} placeholder="es. AUDI A1 GIALLA" className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Telaio</Label>
                <Input value={vTelaio} onChange={(e) => setVTelaio(e.target.value)} className="h-8 text-xs font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Classe B/M</Label>
                <SearchableSelect className="h-8 text-xs" value={vClasseBm} onValueChange={setVClasseBm} placeholder="—"
                  options={CLASSI_MERITO} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Immatricolazione</Label>
                <Input type="date" value={vDataImmatricolazione} onChange={(e) => setVDataImmatricolazione(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Anno Acquisto</Label>
                <Input type="number" value={vAnnoAcquisto} onChange={(e) => setVAnnoAcquisto(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            {/* Massimali */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Massimale 1</Label><Input type="number" step="0.01" value={vMass1} onChange={(e) => setVMass1(e.target.value)} className="h-8 text-xs font-mono" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Massimale 2</Label><Input type="number" step="0.01" value={vMass2} onChange={(e) => setVMass2(e.target.value)} className="h-8 text-xs font-mono" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Massimale 3</Label><Input type="number" step="0.01" value={vMass3} onChange={(e) => setVMass3(e.target.value)} className="h-8 text-xs font-mono" /></div>
            </div>
            {/* Flags */}
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {[
                { id: "v-peius", label: "Peius", checked: vPeius, onChange: setVPeius },
                { id: "v-temporanea", label: "Temporanea", checked: vTemporanea, onChange: setVTemporanea },
                { id: "v-caricoscarico", label: "Carico/Scarico", checked: vCaricoScarico, onChange: setVCaricoScarico },
                { id: "v-competizione", label: "Competizione", checked: vCompetizione, onChange: setVCompetizione },
                { id: "v-rimorchio", label: "Rimorchio", checked: vRimorchio, onChange: setVRimorchio },
              ].map((flag) => (
                <div key={flag.id} className="flex items-center gap-1.5">
                  <Checkbox id={flag.id} checked={flag.checked} onCheckedChange={(v) => flag.onChange(v === true)} />
                  <Label htmlFor={flag.id} className="font-normal cursor-pointer text-xs">{flag.label}</Label>
                </div>
              ))}
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Franchigia</Label><Input type="number" step="0.01" value={vFranchigia} onChange={(e) => setVFranchigia(e.target.value)} className="h-8 text-xs font-mono w-40" /></div>
            {/* Dati tecnici */}
            <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">CV</Label><Input type="number" value={vCv} onChange={(e) => setVCv(e.target.value)} className="h-8 text-xs font-mono" /></div>
              <div className="space-y-1.5"><Label className="text-xs">KW</Label><Input type="number" value={vKw} onChange={(e) => setVKw(e.target.value)} className="h-8 text-xs font-mono" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CC</Label><Input type="number" value={vCc} onChange={(e) => setVCc(e.target.value)} className="h-8 text-xs font-mono" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Posti</Label><Input type="number" value={vPosti} onChange={(e) => setVPosti(e.target.value)} className="h-8 text-xs font-mono" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Peso Mot.</Label><Input type="number" value={vPesoMotrice} onChange={(e) => setVPesoMotrice(e.target.value)} className="h-8 text-xs font-mono" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Peso Rim.</Label><Input type="number" value={vPesoRimorchio} onChange={(e) => setVPesoRimorchio(e.target.value)} className="h-8 text-xs font-mono" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Peso Tot.</Label><Input type="number" value={vPesoTotale} onChange={(e) => setVPesoTotale(e.target.value)} className="h-8 text-xs font-mono" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipologia Guida</Label>
                <SearchableSelect className="h-8 text-xs" value={vTipologiaGuida} onValueChange={setVTipologiaGuida} placeholder="—"
                  options={["Libera","Esperta","Esclusiva"].map(v => ({ value: v, label: v }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo Alimentazione</Label>
                <SearchableSelect className="h-8 text-xs" value={vTipoAlimentazione} onValueChange={setVTipoAlimentazione} placeholder="—"
                  options={["Benzina","Diesel","GPL","Metano","Ibrido","Elettrico"].map(v => ({ value: v, label: v }))} />
              </div>
            </div>
          </fieldset>

          {/* DATI PREMIO PER GARANZIA */}
          <fieldset className="border border-border rounded-lg p-5 space-y-4 border-l-4 border-l-primary">
            <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">💰 Dati Premio per Garanzia</legend>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground w-48">Garanzia</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Capitale</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Tasso</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Firma</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Rata</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Annuo</th>
                  </tr>
                </thead>
                <tbody>
                  {premiGaranzia.map((pg, idx) => (
                    <tr key={pg.garanzia} className="border-b border-border/50">
                      <td className="py-1 px-2 font-medium text-foreground">{pg.garanzia}</td>
                      {(["capitale", "tasso", "firma", "rata", "annuo"] as const).map((col) => (
                        <td key={col} className="py-1 px-1">
                          <Input type="number" step="0.01" value={(pg as any)[col]}
                            onChange={(e) => {
                              const updated = [...premiGaranzia];
                              (updated[idx] as any)[col] = e.target.value;
                              setPremiGaranzia(updated);
                            }}
                            className="h-7 text-xs font-mono text-right w-24" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </fieldset>

          {/* DATI CONDUCENTE */}
          <fieldset className="border border-border rounded-lg p-5 space-y-4 border-l-4 border-l-primary">
            <legend className="px-2 text-sm font-bold uppercase text-primary bg-primary/10 rounded py-0.5">👤 Dati Conducente</legend>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Nome</Label><Input value={cNome} onChange={(e) => setCNome(e.target.value)} className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Cognome</Label><Input value={cCognome} onChange={(e) => setCCognome(e.target.value)} className="h-8 text-xs" /></div>
              <div className="space-y-1.5 col-span-2"><Label className="text-xs">Indirizzo</Label><Input value={cIndirizzo} onChange={(e) => setCIndirizzo(e.target.value)} className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">CAP</Label><Input value={cCap} onChange={(e) => setCCap(e.target.value)} className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Città</Label><Input value={cCitta} onChange={(e) => setCCitta(e.target.value)} className="h-8 text-xs" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Provincia</Label><Input value={cProvincia} onChange={(e) => setCProvincia(e.target.value)} className="h-8 text-xs w-20" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Data Nascita</Label><Input type="date" value={cDataNascita} onChange={(e) => setCDataNascita(e.target.value)} className="h-8 text-xs" /></div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo Patente</Label>
                <SearchableSelect className="h-8 text-xs" value={cTipoPatente} onValueChange={setCTipoPatente} placeholder="—"
                  options={["AM","A1","A2","A","B","BE","C","CE","D","DE"].map(v => ({ value: v, label: v }))} />
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Data Rilascio Patente</Label><Input type="date" value={cDataRilascioPatente} onChange={(e) => setCDataRilascioPatente(e.target.value)} className="h-8 text-xs" /></div>
              <div className="space-y-1.5 col-span-2"><Label className="text-xs">Note</Label><Input value={cNote} onChange={(e) => setCNote(e.target.value)} className="h-8 text-xs" /></div>
            </div>
          </fieldset>
        </>
      )}

      {/* ACTIONS */}
      <div className="flex justify-between pt-2">
        <Button variant="secondary" onClick={() => navigate("/portafoglio/gestione-polizze")}>Chiudi</Button>
        <Button onClick={handleConferma} disabled={saving}>{saving ? "Salvataggio..." : "Conferma"}</Button>
      </div>

    </div>
  );
};

export default ImmissionePolizzaPage;
