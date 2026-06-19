import { useState, useRef, useEffect, useMemo } from "react";
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

import { Search, Car, Receipt, User, Info, Users, FileText, Calendar, Shield, DollarSign, Percent, Tag, ShieldCheck, UserCheck, Truck } from "lucide-react";
import { PremiGaranziaCardShell, emptyGaranziaRow, type GaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";
import { LibroMatricolaDialog, filterRigheValide, type LibroMatricolaRiga } from "@/components/polizze/LibroMatricolaDialog";
import {
  syncQuietanzaFromFirma,
  markQuietanzaEdits,
  mirrorAllFromFirma,
  resetQuietanzaRow,
  isQuietanzaSincronizzata,
} from "@/components/polizze/premiSync";

import { SearchableSelect } from "@/components/SearchableSelect";
import { RamoSottoramoSelect } from "@/components/polizze/RamoSottoramoSelect";


import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { CLASSI_MERITO, TIPI_VEICOLO, PROVINCE_IT, TIPI_PATENTE, defaultPatenteForVeicolo, isTargaItValid } from "@/lib/rcaConstants";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { parseCF } from "@/lib/parseCF";
import { lookupComune } from "@/lib/comuniItaliani";

// resolvePercentualeProvvigione non più usato: matrice caricata inline per calcolo per-riga
import { MarcaCombobox, ModelloCombobox } from "@/components/rca/MarcaModelloCombobox";
import { useRcaUsi } from "@/hooks/useRcaLookups";
import { useAccountExecutivesLookup } from "@/hooks/useAccountExecutivesLookup";
import { NuovoClienteDialog, type NuovoClienteInitialData } from "@/components/clienti/NuovoClienteDialog";
import { UserPlus, Sparkles, X } from "lucide-react";
import { PolizzaSection } from "@/components/polizze/PolizzaSection";
import { ImportNuovaPolizzaAIDialog, type MatchResult } from "@/components/polizze/ImportNuovaPolizzaAIDialog";
import { isValidCigWithFlag, normalizeCig } from "@/lib/validateCig";
import { FieldHint } from "@/components/ui/field-hint";
import { useDraftPersistence, loadDraft, clearDraft } from "@/hooks/useDraftPersistence";
import { computeQuietanzePlan } from "@/lib/quietanzePlan";
import { QuietanzeEditor, type QuietanzaDraft } from "@/components/polizze/QuietanzeEditor";

const ImmissionePolizzaPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClienteId = searchParams.get("clienteId");
  // --- Modalità REGOLAZIONE PREMIO ---
  // Apertura da AppendiceDialog (Gestione Polizze) o da TitoloDetail.
  // La pagina precompila i dati dalla polizza madre e crea un nuovo titolo RG
  // collegato a una quietanza di riferimento (selezionabile via banner).
  const regolazioneMode = searchParams.get("mode") === "regolazione";
  const titoloMadreId = searchParams.get("titoloMadreId");
  const initialQuietanzaRefId = searchParams.get("quietanzaRefId");
  const [selectedQuietanzaRefId, setSelectedQuietanzaRefId] = useState<string>(initialQuietanzaRefId || "");
  const regolazionePrefilledRef = useRef<string | null>(null);
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [aiImportOpen, setAiImportOpen] = useState(false);
  const [nuovoClienteOpen, setNuovoClienteOpen] = useState(false);
  const [aiClientePrefill, setAiClientePrefill] = useState<NuovoClienteInitialData | null>(null);
  // Nonce per forzare il remount del NuovoClienteDialog quando arriva un nuovo prefill,
  // evitando race condition tra chiusura/riapertura e useEffect interni.
  const [nuovoClienteNonce, setNuovoClienteNonce] = useState(0);
  // PDF originale caricato dal flusso "Scansione AI Polizza": viene archiviato
  // come documento del titolo subito dopo la creazione della polizza.
  const [aiSourcePdf, setAiSourcePdf] = useState<{ name: string; base64: string; mimeType: string } | null>(null);

  const handleAIImportApply = (m: MatchResult) => {
    const d = m.data;
    if (m.sourcePdf) setAiSourcePdf(m.sourcePdf);
    if (m.cliente?.id) {
      setSelectedClienteId(m.cliente.id);
    } else if (m.isNewCliente) {
      // Apre NuovoClienteDialog precompilato: l'utente DEVE selezionare Gruppo Finanziario
      // (e Codice CIG per gli Enti) prima di poter salvare.
      const piva = (d.contraente_partita_iva || "").trim();
      const cf = (d.contraente_codice_fiscale || "").trim().toUpperCase();
      const nome = (d.contraente_nome || "").trim();
      const isAzienda = !!piva || (!!cf && cf.length === 11);

      // Fallback: se l'AI non ha estratto né nome né CF/P.IVA, avvisa l'utente.
      // Apriamo comunque il dialog (vuoto) così può completare a mano i campi obbligatori.
      const hasMinimalIdentity = !!nome || !!cf || !!piva;
      if (!hasMinimalIdentity) {
        toast.warning(
          "Dati cliente incompleti dal PDF: compila manualmente nome/ragione sociale, CF/P.IVA e il Gruppo Finanziario.",
        );
      }

      // Split Nome/Cognome per i clienti privato (convenzione "NOME COGNOME")
      let nomePrefill: string | undefined;
      let cognomePrefill: string | undefined;
      if (!isAzienda && nome) {
        const tokens = nome.split(/\s+/).filter(Boolean);
        if (tokens.length >= 2) {
          nomePrefill = tokens[0];
          cognomePrefill = tokens.slice(1).join(" ");
        } else {
          nomePrefill = nome;
        }
      }

      const prefill: NuovoClienteInitialData = {
        tipoCliente: m.tipoCliente ?? (isAzienda ? "azienda" : "privato"),
        ragioneSociale: isAzienda ? nome || undefined : undefined,
        nome: nomePrefill,
        cognome: cognomePrefill,
        codiceFiscale: cf || undefined,
        partitaIva: piva || undefined,
        email: d.contraente_email,
        telefono: d.contraente_telefono,
        indirizzo: d.contraente_indirizzo,
        cap: d.contraente_cap,
        citta: d.contraente_comune,
        provincia: d.contraente_provincia,
        nazione: d.contraente_nazione,
        gruppoFinanziarioId: m.gruppoFinanziarioId,
        codiceCig: m.codiceCig,
      };
      // Bumpiamo il nonce: il NuovoClienteDialog viene rimontato (key={nonce}),
      // garantendo stato pulito e applicazione deterministica del nuovo prefill.
      setAiClientePrefill(prefill);
      setNuovoClienteNonce((n) => n + 1);
      setNuovoClienteOpen(true);
      if (cf) setAiCfLookup(cf);
    } else if (d.contraente_codice_fiscale) {
      setAiCfLookup(d.contraente_codice_fiscale);
    }
    if (m.compagnia?.id) setSelectedCompagnia(m.compagnia.id);
    if (m.ramo) {
      setSelectedGruppoRamoId(m.ramo.gruppoRamoId);
      if (m.ramo.ramoId) setSelectedRamo(m.ramo.ramoId);
    }
    if (d.prodotto) setProdottoNome(d.prodotto);
    if (d.numero_polizza) setNumeroPolizza(d.numero_polizza);
    if (d.decorrenza) { setDurataDa(d.decorrenza); }
    if (d.scadenza) { setDurataA(d.scadenza); setDurataATouched(true); }
    if (typeof d.tacito_rinnovo === "boolean") setTacitoRinnovo(d.tacito_rinnovo);
    if (d.frazionamento) {
      const fraz = d.frazionamento.toLowerCase();
      const map: Record<string, string> = {
        annuale: "Annuale", semestrale: "Semestrale", quadrimestrale: "Quadrimestrale",
        trimestrale: "Trimestrale", mensile: "Mensile", poliennale: "Poliennale",
      };
      if (map[fraz]) setFrazionamento(map[fraz]);
    }

    // Premi alla firma: se l'AI ha estratto voci di garanzia dal PDF, crea N righe
    // (una per voce) come nel manuale; altrimenti fallback alla riga unica con i totali.
    const gruppoRamoIdForRows = m.ramo?.gruppoRamoId || null;
    const ramiPerGruppo = (ramiList || []).filter(
      (r: any) => !gruppoRamoIdForRows || r.gruppo_ramo_id === gruppoRamoIdForRows,
    );
    if (Array.isArray(d.garanzie) && d.garanzie.length > 0) {
      const rows: GaranziaRow[] = d.garanzie.map((g) => {
        const codice = (g.codice_sottoramo || "").trim();
        const match = codice ? ramiPerGruppo.find((r: any) => r.codice === codice) : null;
        const ssnAttivo = !!match?.ssn_attivo;
        const aliquotaSsn = ssnAttivo ? (Number(match?.aliquota_ssn) || 10.5) : 0;
        const netto = g.premio_netto != null ? Number(g.premio_netto) : 0;
        const ssnFromAi = g.ssn != null ? Number(g.ssn) : null;
        const ssnAuto = ssnAttivo && netto > 0 ? +((netto * aliquotaSsn) / 100).toFixed(2) : 0;
        // Aliquota tasse: priorità al sottoramo DB (verità canonica), poi al valore AI, poi 0.
        const aliquotaDb = match && match.aliquota_tasse_ramo != null
          ? Number(match.aliquota_tasse_ramo) : null;
        const aliquotaTasse = aliquotaDb != null
          ? aliquotaDb
          : (typeof g.aliquota_tasse_pct === "number" ? g.aliquota_tasse_pct : 0);
        // Tasse: se l'AI non le ha estratte e abbiamo aliquota+netto, calcolale.
        let tasseStr = "";
        if (g.premio_imposte != null) {
          tasseStr = String(g.premio_imposte);
        } else if (aliquotaTasse > 0 && netto > 0) {
          tasseStr = (+((netto * aliquotaTasse) / 100).toFixed(2)).toFixed(2);
        }
        return {
          ...emptyGaranziaRow(),
          codice: match?.codice ?? (codice || null),
          sottoramoId: match?.id ?? null,
          descrizione: g.descrizione || match?.descrizione || "",
          netto: g.premio_netto != null ? String(g.premio_netto) : "",
          tasse: tasseStr,
          aliquotaTasse,
          ssnAttivo,
          aliquotaSsn,
          ssn: ssnFromAi != null ? String(ssnFromAi) : (ssnAuto > 0 ? ssnAuto.toFixed(2) : ""),
          ssnManualOverride: ssnFromAi != null,
        };
      });
      setPremiFirmaRows(rows);
    } else if (d.premio_firma_netto != null || d.premio_firma_imposte != null) {
      setPremiFirmaRows([{ ...emptyGaranziaRow(), netto: d.premio_firma_netto != null ? String(d.premio_firma_netto) : "", tasse: d.premio_firma_imposte != null ? String(d.premio_firma_imposte) : "" }]);
    }
    if (d.premio_firma_accessori != null) setAddizionali(String(d.premio_firma_accessori));
    if (d.premio_quietanza_netto != null || d.premio_quietanza_imposte != null) {
      setPremiQuietanzaRows([{ ...emptyGaranziaRow(), netto: d.premio_quietanza_netto != null ? String(d.premio_quietanza_netto) : "", tasse: d.premio_quietanza_imposte != null ? String(d.premio_quietanza_imposte) : "" }]);
    }
    if (d.premio_quietanza_accessori != null) setAddizionaliQuietanza(String(d.premio_quietanza_accessori));
    if (d.targa) setTargaTelaio(d.targa);

    // === RCA Auto: applica blocco veicolo + conducente ===
    const v = d.veicolo as undefined | {
      targa?: string; telaio?: string; marca?: string; modello?: string; versione?: string;
      descrizione?: string; tipo_veicolo?: string; uso_descrizione?: string;
      data_immatricolazione?: string; anno_acquisto?: string; provincia_circolazione?: string;
      classe_bm?: string; cv?: number; kw?: number; cc?: number; posti?: number;
      peso_motrice?: number; peso_rimorchio?: number; peso_totale?: number;
      alimentazione?: string; tipologia_guida?: string;
      franchigia?: number; massimale_1?: number; massimale_2?: number; massimale_3?: number;
      peius?: boolean; temporanea?: boolean; carico_scarico?: boolean; competizione?: boolean; rimorchio?: boolean;
    };
    const cond = d.conducente as undefined | {
      nome?: string; cognome?: string; codice_fiscale?: string; indirizzo?: string;
      cap?: string; citta?: string; provincia?: string; data_nascita?: string;
      tipo_patente?: string; data_rilascio_patente?: string;
    };
    const ramoIsAuto =
      !!m.polizzaAuto ||
      (m.ramo?.gruppoRamoId && /^ZQ$/i.test(String((m.ramo as any).codice || ""))) ||
      !!(v && (v.targa || v.telaio || v.marca));
    if (ramoIsAuto) {
      setPolizzaAuto(true);
    }
    const prefilledKeys: string[] = [];
    let vCount = 0, cCount = 0;
    if (v && (v.targa || v.telaio || v.marca)) {
      setPolizzaAuto(true);
      if (v.targa) { setVTarga(v.targa.toUpperCase()); if (!d.targa) setTargaTelaio(v.targa.toUpperCase()); prefilledKeys.push("vTarga"); vCount++; }
      if (v.telaio) { setVTelaio(v.telaio.toUpperCase()); prefilledKeys.push("vTelaio"); vCount++; }
      if (v.marca) { setVMarca(v.marca.toUpperCase()); prefilledKeys.push("vMarca"); vCount++; }
      if (v.modello) { setVModello(v.modello.toUpperCase()); prefilledKeys.push("vModello"); vCount++; }
      if (v.versione) { setVVersione(v.versione); prefilledKeys.push("vVersione"); vCount++; }
      if (v.descrizione) { setVDescrizione(v.descrizione); prefilledKeys.push("vDescrizione"); vCount++; }
      if (v.tipo_veicolo) {
        setVTipoVeicolo(v.tipo_veicolo.toUpperCase());
        setVSettore(v.tipo_veicolo);
        prefilledKeys.push("vTipoVeicolo"); vCount++;
      }
      if (v.data_immatricolazione) { setVDataImmatricolazione(v.data_immatricolazione); prefilledKeys.push("vDataImmatricolazione"); vCount++; }
      if (v.anno_acquisto) { setVAnnoAcquisto(String(v.anno_acquisto)); prefilledKeys.push("vAnnoAcquisto"); vCount++; }
      if (v.provincia_circolazione) { setVProvinciaCircolazione(v.provincia_circolazione.toUpperCase()); prefilledKeys.push("vProvinciaCircolazione"); vCount++; }
      if (v.classe_bm) { setVClasseBm(String(v.classe_bm)); prefilledKeys.push("vClasseBm"); vCount++; }
      if (v.cv != null) { setVCv(String(v.cv)); prefilledKeys.push("vCv"); vCount++; }
      if (v.kw != null) { setVKw(String(v.kw)); prefilledKeys.push("vKw"); vCount++; }
      if (v.cc != null) { setVCc(String(v.cc)); prefilledKeys.push("vCc"); vCount++; }
      if (v.posti != null) { setVPosti(String(v.posti)); prefilledKeys.push("vPosti"); vCount++; }
      if (v.peso_motrice != null) { setVPesoMotrice(String(v.peso_motrice)); prefilledKeys.push("vPesoMotrice"); vCount++; }
      if (v.peso_rimorchio != null) { setVPesoRimorchio(String(v.peso_rimorchio)); prefilledKeys.push("vPesoRimorchio"); vCount++; }
      if (v.peso_totale != null) { setVPesoTotale(String(v.peso_totale)); prefilledKeys.push("vPesoTotale"); vCount++; }
      if (v.alimentazione) { setVTipoAlimentazione(v.alimentazione); prefilledKeys.push("vTipoAlimentazione"); vCount++; }
      if (v.tipologia_guida) { setVTipologiaGuida(v.tipologia_guida); prefilledKeys.push("vTipologiaGuida"); vCount++; }
      if (v.franchigia != null) { setVFranchigia(String(v.franchigia)); prefilledKeys.push("vFranchigia"); vCount++; }
      if (v.massimale_1 != null) { setVMass1(String(v.massimale_1)); prefilledKeys.push("vMass1"); vCount++; }
      if (v.massimale_2 != null) { setVMass2(String(v.massimale_2)); prefilledKeys.push("vMass2"); vCount++; }
      if (v.massimale_3 != null) { setVMass3(String(v.massimale_3)); prefilledKeys.push("vMass3"); vCount++; }
      if (v.peius != null) { setVPeius(!!v.peius); if (v.peius) vCount++; }
      if (v.temporanea != null) { setVTemporanea(!!v.temporanea); if (v.temporanea) vCount++; }
      if (v.carico_scarico != null) { setVCaricoScarico(!!v.carico_scarico); if (v.carico_scarico) vCount++; }
      if (v.competizione != null) { setVCompetizione(!!v.competizione); if (v.competizione) vCount++; }
      if (v.rimorchio != null) { setVRimorchio(!!v.rimorchio); if (v.rimorchio) vCount++; }
    }
    if (cond) {
      if (cond.nome) { setCNome(cond.nome); prefilledKeys.push("cNome"); cCount++; }
      if (cond.cognome) { setCCognome(cond.cognome); prefilledKeys.push("cCognome"); cCount++; }
      if (cond.indirizzo) { setCIndirizzo(cond.indirizzo); prefilledKeys.push("cIndirizzo"); cCount++; }
      if (cond.cap) { setCCap(cond.cap); prefilledKeys.push("cCap"); cCount++; }
      if (cond.citta) { setCCitta(cond.citta); prefilledKeys.push("cCitta"); cCount++; }
      if (cond.provincia) { setCProvincia(cond.provincia.toUpperCase()); prefilledKeys.push("cProvincia"); cCount++; }
      if (cond.data_nascita) { setCDataNascita(cond.data_nascita); prefilledKeys.push("cDataNascita"); cCount++; }
      if (cond.tipo_patente) { setCTipoPatente(cond.tipo_patente); prefilledKeys.push("cTipoPatente"); cCount++; }
      if (cond.data_rilascio_patente) { setCDataRilascioPatente(cond.data_rilascio_patente); prefilledKeys.push("cDataRilascioPatente"); cCount++; }
    }
    // Fallback: se provincia_circolazione manca ma c'è quella del conducente, usala
    if (v && !v.provincia_circolazione && cond?.provincia) {
      setVProvinciaCircolazione(cond.provincia.toUpperCase());
      prefilledKeys.push("vProvinciaCircolazione");
    }
    if (prefilledKeys.length) markAiPrefilled(...prefilledKeys);

    toast.success(m.isNewCliente && !m.cliente?.id
      ? "Dati applicati. Completa la creazione del nuovo cliente (Gruppo Finanziario obbligatorio)."
      : ramoIsAuto && (vCount || cCount)
        ? `AI ha compilato ${vCount} campi veicolo + ${cCount} campi conducente`
        : "Dati applicati al form");
  };


  // Form state — Cliente
  const [aiCfLookup, setAiCfLookup] = useState(""); // CF/P.IVA arrivato da import AI per auto-selezione
  const [clienteSearch, setClienteSearch] = useState("");
  const [debouncedClienteSearch, setDebouncedClienteSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedClienteSearch(clienteSearch), 350);
    return () => clearTimeout(t);
  }, [clienteSearch]);
  const [selectedAE, setSelectedAE] = useState("");
  const [selectedAccountExecutiveId, setSelectedAccountExecutiveId] = useState("");
  const [selectedClienteId, setSelectedClienteId] = useState(() => preselectedClienteId || "");
  const [selectedUfficioId, setSelectedUfficioId] = useState("");
  const [selectedBackofficeId, setSelectedBackofficeId] = useState("");

  // Form state — Polizza
  const [numeroPolizza, setNumeroPolizza] = useState("");
  const [tipoOperazione, setTipoOperazione] = useState("polizza");
  const [polizzaAuto, setPolizzaAuto] = useState(false);
  const [righeMatricola, setRigheMatricola] = useState<LibroMatricolaRiga[]>([]);
  const [matricolaDialogOpen, setMatricolaDialogOpen] = useState(false);
  const isLibroMatricola = tipoOperazione === "libro_matricola";
  
  

  // Contratto
  const [selectedCompagnia, setSelectedCompagnia] = useState("");
  const [selectedGruppoCompagniaId, setSelectedGruppoCompagniaId] = useState<string>("");
  const [selectedRapportoId, setSelectedRapportoId] = useState<string>("");
  const [selectedRamo, setSelectedRamo] = useState("");
  const [selectedGruppoRamoId, setSelectedGruppoRamoId] = useState<string | null>(null);
  /** Sottoramo di default proposto nelle nuove righe garanzia (Firma + Quietanza). */
  const [defaultSottoramoId, setDefaultSottoramoId] = useState<string | null>(null);

  const [prodottoNome, setProdottoNome] = useState("");
  // 'specialist' hardcoded state rimosso: ora si usa solo selectedBackofficeId
  
  const [cigRif, setCigRif] = useState("");
  const [cigTemporaneo, setCigTemporaneo] = useState(false);
  const [vincolo, setVincolo] = useState("");
  const [targaTelaio, setTargaTelaio] = useState("");
  const [descrizionePolizza, setDescrizionePolizza] = useState("");

  // Periodo
  const todayISO = new Date().toISOString().slice(0, 10);
  const [durataDa, setDurataDa] = useState(todayISO);
  const [durataA, setDurataA] = useState("");
  const [durataATouched, setDurataATouched] = useState(false);
  const [anniDurata, setAnniDurata] = useState("1");
  const [tacitoRinnovo, setTacitoRinnovo] = useState(true);
  const [frazionamento, setFrazionamento] = useState<string>("Annuale");
  const [moraGiorni, setMoraGiorni] = useState("15");
  const [garanziaDa, setGaranziaDa] = useState("");
  const [garanziaDaTouched, setGaranziaDaTouched] = useState(false);
  const [garanziaA, setGaranziaA] = useState("");
  const [garanziaATouched, setGaranziaATouched] = useState(false);
  const [dataCompetenza, setDataCompetenza] = useState("");
  const [dataCompetenzaTouched, setDataCompetenzaTouched] = useState(false);
  const [limiteMora, setLimiteMora] = useState("");
  const [limiteMoraTouched, setLimiteMoraTouched] = useState(false);
  const [disdettaMesi, setDisdettaMesi] = useState("");

  // Quietanze editor: drafts per-rata raccolti dalla sezione "Quietanze" del form.
  // Vengono applicati DOPO l'insert del titolo: il trigger DB crea polizza+quietanze,
  // poi noi sovrascriviamo i campi editati dall'utente rata per rata.
  const [quietanzeDrafts, setQuietanzeDrafts] = useState<QuietanzaDraft[]>([]);

  // Regolazione
  const [regolazione, setRegolazione] = useState(false);
  const [tipoLetteraRegolazione, setTipoLetteraRegolazione] = useState("");
  const [tipoScadenza, setTipoScadenza] = useState("no_scadenza");
  const [giorniPresentazione, setGiorniPresentazione] = useState("");
  const [periodicita, setPeriodicita] = useState("annuale");
  const [libroMatricola, setLibroMatricola] = useState("no");

  // Importi — multi-row garanzie
  const [premiFirmaRows, setPremiFirmaRows] = useState<GaranziaRow[]>([emptyGaranziaRow()]);
  const [premiQuietanzaRows, setPremiQuietanzaRows] = useState<GaranziaRow[]>([emptyGaranziaRow()]);
  const [addizionali, setAddizionali] = useState("0");
  const [valuta, setValuta] = useState("EUR");
  const [addizionaliQuietanza, setAddizionaliQuietanza] = useState("0");
  // Flags
  const [rimborso, setRimborso] = useState(false);
  const [indicizzata, setIndicizzata] = useState(false);
  const [noCalcoloTasse, setNoCalcoloTasse] = useState(false);
  const [pagDirettoCompagnia, setPagDirettoCompagnia] = useState(false);
  const [emissioneFee, setEmissioneFee] = useState(false);
  const [formatoElettronico, setFormatoElettronico] = useState(false);
  const [cambio, setCambio] = useState("1");
  // Flag: percentuale commerciale auto-popolata da produttori_provvigioni_ramo
  const [percentualeCommercialeAuto, setPercentualeCommercialeAuto] = useState(false);

  // Provvigioni: auto-popolata da resolvePercentualeProvvigione (Rapporto + Ramo + Sottoramo)
  const [percentualeProvvigione, setPercentualeProvvigione] = useState("");
  const [percentualeProvvigioneAuto, setPercentualeProvvigioneAuto] = useState(true);
  const [provvigioneFonte, setProvvigioneFonte] = useState<string>("");
  const [provvigioneWarning, setProvvigioneWarning] = useState<string>("");

  // Brokeraggio (quota del Produttore — default da anagrafiche_professionali.percentuale_consulenza)
  const [percentualeBrokeraggio, setPercentualeBrokeraggio] = useState("");
  const [percentualeBrokeraggioAuto, setPercentualeBrokeraggioAuto] = useState(false);

  // Quota provvigione Account Executive (default 0 — AE = produttore aggiuntivo, residuo a Consul)
  const [percentualeAE, setPercentualeAE] = useState("0");

  // === RCA AUTO State ===
  // Veicolo
  const [vSettore, setVSettore] = useState("Autovetture");
  const [vTipoVeicolo, setVTipoVeicolo] = useState("AUTOVETTURA");
  const [vUso, setVUso] = useState("");
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
  const { data: rcaUsi } = useRcaUsi();
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
  // (Le righe garanzia/Firma/Quietanza sono in premiFirmaRows / premiQuietanzaRows.)
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

  // Tracciamento campi compilati dall'AI (per indicatore visivo ✨)
  const [aiPrefilled, setAiPrefilled] = useState<Set<string>>(new Set());
  const markAiPrefilled = (...keys: string[]) => {
    setAiPrefilled((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
  };
  const clearAiPrefilled = (key: string) => {
    setAiPrefilled((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };
  // Toggle "Conducente = Contraente"
  const [conducenteUgualeContraente, setConducenteUgualeContraente] = useState(false);
  // Lock sincronizzazione KW/CV (se l'utente edita manualmente uno dei due)
  const [kwCvLocked, setKwCvLocked] = useState<null | "cv" | "kw">(null);

  // Commerciale

  const [selectedCommerciale, setSelectedCommerciale] = useState("__sede__");
  const [percentualeCommerciale, setPercentualeCommerciale] = useState("100");

  // === Autosave bozza locale (localStorage) ===
  const draftKey = `immissione:v1:${selectedClienteId || preselectedClienteId || "new"}`;
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const draftHydratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (draftHydratedKeyRef.current === draftKey) return;
    draftHydratedKeyRef.current = draftKey;
    const loaded = loadDraft<Record<string, any>>(draftKey);
    if (loaded?.data) {
      const d = loaded.data;
      const setters: Record<string, (v: any) => void> = {
        selectedAE: setSelectedAE,
        selectedAccountExecutiveId: setSelectedAccountExecutiveId,
        selectedClienteId: setSelectedClienteId,
        selectedUfficioId: setSelectedUfficioId,
        selectedBackofficeId: setSelectedBackofficeId,
        numeroPolizza: setNumeroPolizza,
        tipoOperazione: setTipoOperazione,
        polizzaAuto: setPolizzaAuto,
        selectedCompagnia: setSelectedCompagnia,
        selectedGruppoCompagniaId: setSelectedGruppoCompagniaId,
        selectedRapportoId: setSelectedRapportoId,
        selectedRamo: setSelectedRamo,
        selectedGruppoRamoId: setSelectedGruppoRamoId,
        prodottoNome: setProdottoNome,
        cigRif: setCigRif,
        cigTemporaneo: setCigTemporaneo,
        vincolo: setVincolo,
        targaTelaio: setTargaTelaio,
        descrizionePolizza: setDescrizionePolizza,
        durataDa: setDurataDa,
        durataA: setDurataA,
        durataATouched: setDurataATouched,
        anniDurata: setAnniDurata,
        tacitoRinnovo: setTacitoRinnovo,
        frazionamento: setFrazionamento,
        moraGiorni: setMoraGiorni,
        garanziaDa: setGaranziaDa,
        garanziaDaTouched: setGaranziaDaTouched,
        garanziaA: setGaranziaA,
        garanziaATouched: setGaranziaATouched,
        dataCompetenza: setDataCompetenza,
        dataCompetenzaTouched: setDataCompetenzaTouched,
        limiteMora: setLimiteMora,
        limiteMoraTouched: setLimiteMoraTouched,
        disdettaMesi: setDisdettaMesi,
        regolazione: setRegolazione,
        tipoLetteraRegolazione: setTipoLetteraRegolazione,
        tipoScadenza: setTipoScadenza,
        giorniPresentazione: setGiorniPresentazione,
        periodicita: setPeriodicita,
        libroMatricola: setLibroMatricola,
        premiFirmaRows: setPremiFirmaRows,
        premiQuietanzaRows: setPremiQuietanzaRows,
        addizionali: setAddizionali,
        valuta: setValuta,
        addizionaliQuietanza: setAddizionaliQuietanza,
        rimborso: setRimborso,
        indicizzata: setIndicizzata,
        noCalcoloTasse: setNoCalcoloTasse,
        pagDirettoCompagnia: setPagDirettoCompagnia,
        emissioneFee: setEmissioneFee,
        formatoElettronico: setFormatoElettronico,
        cambio: setCambio,
        percentualeCommercialeAuto: setPercentualeCommercialeAuto,
        percentualeProvvigione: setPercentualeProvvigione,
        percentualeProvvigioneAuto: setPercentualeProvvigioneAuto,
        percentualeBrokeraggio: setPercentualeBrokeraggio,
        percentualeBrokeraggioAuto: setPercentualeBrokeraggioAuto,
        percentualeAE: setPercentualeAE,
        vSettore: setVSettore,
        vTipoVeicolo: setVTipoVeicolo,
        vUso: setVUso,
        vMarca: setVMarca,
        vModello: setVModello,
        vVersione: setVVersione,
        vTarga: setVTarga,
        vTelaio: setVTelaio,
        vDescrizione: setVDescrizione,
        vDataImmatricolazione: setVDataImmatricolazione,
        vAnnoAcquisto: setVAnnoAcquisto,
        vProvinciaCircolazione: setVProvinciaCircolazione,
        vClasseBm: setVClasseBm,
        vMass1: setVMass1,
        vMass2: setVMass2,
        vMass3: setVMass3,
        vPeius: setVPeius,
        vFranchigia: setVFranchigia,
        vTemporanea: setVTemporanea,
        vCaricoScarico: setVCaricoScarico,
        vCompetizione: setVCompetizione,
        vRimorchio: setVRimorchio,
        vCv: setVCv,
        vKw: setVKw,
        vCc: setVCc,
        vPosti: setVPosti,
        vPesoMotrice: setVPesoMotrice,
        vPesoRimorchio: setVPesoRimorchio,
        vPesoTotale: setVPesoTotale,
        vTipologiaGuida: setVTipologiaGuida,
        vTipoAlimentazione: setVTipoAlimentazione,
        cNome: setCNome,
        cCognome: setCCognome,
        cIndirizzo: setCIndirizzo,
        cCap: setCCap,
        cCitta: setCCitta,
        cProvincia: setCProvincia,
        cDataNascita: setCDataNascita,
        cTipoPatente: setCTipoPatente,
        cDataRilascioPatente: setCDataRilascioPatente,
        cNote: setCNote,
        selectedCommerciale: setSelectedCommerciale,
        percentualeCommerciale: setPercentualeCommerciale,
      };
      // Campi che hanno un default ereditato dall'anagrafica cliente:
      // se la bozza ha valore vuoto/null, NON sovrascrivere così che vinca
      // il default proveniente da `clienti.ufficio_id` / `codici_commerciali_cliente`.
      const skipIfEmptyKeys = new Set([
        "selectedUfficioId",
        "selectedAE",
        "selectedAccountExecutiveId",
        "selectedBackofficeId",
      ]);
      for (const k of Object.keys(d)) {
        const fn = setters[k];
        if (!fn || d[k] === undefined) continue;
        if (skipIfEmptyKeys.has(k) && (d[k] === null || d[k] === "")) continue;
        fn(d[k]);
      }
      setDraftRestoredAt(loaded.ts);
    }
    setDraftHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const draftSnapshot = {
    selectedAE, selectedAccountExecutiveId, selectedClienteId, selectedUfficioId, selectedBackofficeId,
    numeroPolizza, tipoOperazione, polizzaAuto,
    selectedCompagnia, selectedGruppoCompagniaId, selectedRapportoId, selectedRamo, selectedGruppoRamoId, prodottoNome,
    cigRif, cigTemporaneo, vincolo, targaTelaio, descrizionePolizza,
    durataDa, durataA, durataATouched, anniDurata, tacitoRinnovo, frazionamento, moraGiorni,
    garanziaDa, garanziaDaTouched, garanziaA, garanziaATouched, dataCompetenza, dataCompetenzaTouched,
    limiteMora, limiteMoraTouched, disdettaMesi,
    regolazione, tipoLetteraRegolazione, tipoScadenza, giorniPresentazione, periodicita, libroMatricola,
    premiFirmaRows, premiQuietanzaRows, addizionali, valuta, addizionaliQuietanza,
    rimborso, indicizzata, noCalcoloTasse, pagDirettoCompagnia, emissioneFee, formatoElettronico, cambio,
    percentualeCommercialeAuto,
    percentualeProvvigione, percentualeProvvigioneAuto,
    percentualeBrokeraggio, percentualeBrokeraggioAuto,
    percentualeAE,
    vSettore, vTipoVeicolo, vUso, vMarca, vModello, vVersione, vTarga, vTelaio, vDescrizione,
    vDataImmatricolazione, vAnnoAcquisto, vProvinciaCircolazione, vClasseBm,
    vMass1, vMass2, vMass3, vPeius, vFranchigia, vTemporanea, vCaricoScarico, vCompetizione, vRimorchio,
    vCv, vKw, vCc, vPosti, vPesoMotrice, vPesoRimorchio, vPesoTotale, vTipologiaGuida, vTipoAlimentazione,
    cNome, cCognome, cIndirizzo, cCap, cCitta, cProvincia, cDataNascita, cTipoPatente, cDataRilascioPatente, cNote,
    selectedCommerciale, percentualeCommerciale,
  };

  useDraftPersistence(draftKey, draftSnapshot, { enabled: draftHydrated });

  // Segnala al version-guard che c'è un form aperto: evita reload del bundle
  // mentre l'utente sta compilando la polizza (la pagina resterebbe
  // letteralmente refreshata con perdita di dati non ancora persistiti).
  useEffect(() => {
    (window as any).__lovableFormDirty = true;
    return () => { (window as any).__lovableFormDirty = false; };
  }, []);




  // --- Queries ---

  const { data: clienteData } = useQuery({
    queryKey: ["cliente-lookup", aiCfLookup],
    queryFn: async () => {
      if (!aiCfLookup || aiCfLookup.length < 2) return null;
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale, tipo_cliente, gruppo_finanziario_id")
        .or(`codice_fiscale.ilike.%${aiCfLookup}%,partita_iva.ilike.%${aiCfLookup}%,codice_ricerca.ilike.%${aiCfLookup}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: aiCfLookup.length >= 2,
  });

  // Ricerca server-side per il SearchableSelect cliente (multi-token, sanitizzata, debounced)
  const { data: clientiSearchResults } = useQuery({
    queryKey: ["clienti-search-immissione", debouncedClienteSearch],
    queryFn: async () => {
      const raw = (debouncedClienteSearch || "").replace(/[%,()]/g, " ").trim();
      if (raw.length < 2) {
        const { data, error } = await supabase
          .from("clienti")
          .select("id, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, tipo_cliente, ufficio_id")
          .eq("attivo", true)
          .order("ragione_sociale", { nullsFirst: false })
          .limit(50);
        if (error) { console.error("[clienti-search]", error); return []; }
        return data || [];
      }
      const tokens = raw.split(/\s+/).filter(Boolean);
      const first = tokens[0];
      const term = `%${first}%`;
      const { data, error } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, codice_ricerca, tipo_cliente, ufficio_id")
        .eq("attivo", true)
        .or(
          `ragione_sociale.ilike.${term},cognome.ilike.${term},nome.ilike.${term},codice_fiscale.ilike.${term},partita_iva.ilike.${term},codice_ricerca.ilike.${term}`
        )
        .order("ragione_sociale", { nullsFirst: false })
        .limit(100);
      if (error) { console.error("[clienti-search]", error); return []; }
      const rest = tokens.slice(1).map((t) => t.toLowerCase());
      const filtered = (data || []).filter((c: any) => {
        if (rest.length === 0) return true;
        const hay = [
          c.ragione_sociale,
          c.cognome,
          c.nome,
          c.codice_fiscale,
          c.partita_iva,
          c.codice_ricerca,
        ].filter(Boolean).join(" ").toLowerCase();
        return rest.every((t) => hay.includes(t));
      });
      return filtered.slice(0, 50);
    },
    staleTime: 300000 * 30,
  });

  // Dettaglio cliente selezionato (per eredità ufficio)
  const { data: clienteDettaglio } = useQuery({
    queryKey: ["cliente-dettaglio-immissione", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return null;
      const { data } = await supabase
        .from("clienti")
        .select("id, nome, cognome, ragione_sociale, codice_fiscale, partita_iva, tipo_cliente, ufficio_id, gruppo_finanziario_id, indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza, indirizzo_sede, cap_sede, citta_sede, provincia_sede, data_nascita, gruppi_finanziari!clienti_gruppo_finanziario_id_fkey(id, codice, nome, tipo_soggetto)")
        .eq("id", selectedClienteId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!selectedClienteId,
  });

  const { data: clienteAE } = useQuery({
    queryKey: ["cliente-ae-bo", selectedClienteId],
    queryFn: async () => {
      if (!selectedClienteId) return [];
      const { data } = await supabase
        .from("codici_commerciali_cliente")
        .select("profilo_id, anagrafica_id, ruolo, profiles:profilo_id(id, nome, cognome)")
        .eq("cliente_id", selectedClienteId)
        .in("ruolo", ["account_executive", "AE", "Backoffice", "Produttore Sede"]);
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

  // Prefill Compagnia/Agenzia dall'ultima polizza del cliente.
  // Si attiva solo quando il cliente cambia e i campi compagnia sono ancora vuoti.
  // L'utente può comunque modificare; la "preferenza" è sempre l'ultima polizza salvata.
  const prefilledForClienteRef = useRef<string | null>(null);
  const [prefilledHint, setPrefilledHint] = useState(false);
  useEffect(() => {
    if (!selectedClienteId) return;
    if (prefilledForClienteRef.current === selectedClienteId) return;
    if (selectedCompagnia || selectedRapportoId) {
      // utente ha già scelto qualcosa (o ereditato da AI/bozza): non sovrascrivere
      prefilledForClienteRef.current = selectedClienteId;
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: lastTit } = await supabase
        .from("titoli")
        .select("compagnia_id, compagnia_rapporto_id")
        .eq("cliente_anagrafica_id", selectedClienteId)
        .not("compagnia_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !lastTit?.compagnia_id) {
        prefilledForClienteRef.current = selectedClienteId;
        return;
      }
      const { data: comp } = await supabase
        .from("compagnie")
        .select("id, tipo, gruppo_compagnia_id")
        .eq("id", lastTit.compagnia_id)
        .maybeSingle();
      if (cancelled) return;
      if (comp?.gruppo_compagnia_id && (comp.tipo === "agenzia" || comp.tipo === "direzione")) {
        setSelectedGruppoCompagniaId(comp.gruppo_compagnia_id);
      }
      setSelectedCompagnia(lastTit.compagnia_id);
      if (lastTit.compagnia_rapporto_id) setSelectedRapportoId(lastTit.compagnia_rapporto_id);
      setPrefilledHint(true);
      prefilledForClienteRef.current = selectedClienteId;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClienteId]);

  // ============= REGOLAZIONE PREMIO: load polizza madre + quietanze + prefill =============
  const { data: polizzaMadre } = useQuery({
    queryKey: ["regolazione-polizza-madre", titoloMadreId],
    enabled: regolazioneMode && !!titoloMadreId,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select(`*,
          cliente:clienti!titoli_cliente_anagrafica_id_fkey(id, ragione_sociale, nome, cognome),
          compagnia:compagnie!titoli_compagnia_id_fkey(id, nome),
          rapporto:compagnia_rapporti!titoli_compagnia_rapporto_id_fkey(id, codice_rapporto, nome_rapporto, tipo_rapporto)
        `)
        .eq("id", titoloMadreId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: quietanzePolizza } = useQuery({
    queryKey: ["regolazione-quietanze", polizzaMadre?.numero_titolo],
    enabled: regolazioneMode && !!polizzaMadre?.numero_titolo,
    queryFn: async () => {
      const { data } = await supabase
        .from("titoli")
        .select("id, numero_titolo, riga, durata_da, durata_a, stato, data_messa_cassa, premio_lordo")
        .eq("numero_titolo", polizzaMadre!.numero_titolo)
        .order("riga", { ascending: true });
      return data || [];
    },
  });

  // Prefill form da polizza madre (una sola volta per polizza)
  useEffect(() => {
    if (!regolazioneMode || !polizzaMadre) return;
    if (regolazionePrefilledRef.current === polizzaMadre.id) return;
    regolazionePrefilledRef.current = polizzaMadre.id;

    if (polizzaMadre.cliente_anagrafica_id) setSelectedClienteId(polizzaMadre.cliente_anagrafica_id);
    if (polizzaMadre.numero_titolo) setNumeroPolizza(polizzaMadre.numero_titolo);
    if (polizzaMadre.prodotto_nome) setProdottoNome(polizzaMadre.prodotto_nome);
    if (polizzaMadre.compagnia_id) setSelectedCompagnia(polizzaMadre.compagnia_id);
    if ((polizzaMadre as any).compagnia_rapporto_id) setSelectedRapportoId((polizzaMadre as any).compagnia_rapporto_id);
    if (polizzaMadre.ramo_id) setSelectedRamo(polizzaMadre.ramo_id);
    if (polizzaMadre.durata_da) setDurataDa(polizzaMadre.durata_da);
    if (polizzaMadre.durata_a) { setDurataA(polizzaMadre.durata_a); setDurataATouched(true); }
    if (polizzaMadre.anni_durata) setAnniDurata(String(polizzaMadre.anni_durata));
    if (polizzaMadre.frazionamento) setFrazionamento(polizzaMadre.frazionamento);
    if (typeof polizzaMadre.tacito_rinnovo === "boolean") setTacitoRinnovo(polizzaMadre.tacito_rinnovo);
    if (polizzaMadre.descrizione_polizza) setDescrizionePolizza(polizzaMadre.descrizione_polizza);
    if ((polizzaMadre as any).anagrafica_commerciale_id) setSelectedAE((polizzaMadre as any).anagrafica_commerciale_id);
    if ((polizzaMadre as any).ae_anagrafica_id) setSelectedAccountExecutiveId((polizzaMadre as any).ae_anagrafica_id);
    if (polizzaMadre.ufficio_id) setSelectedUfficioId(polizzaMadre.ufficio_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regolazioneMode, polizzaMadre]);

  // Quietanza di riferimento di default: l'ultima incassata, altrimenti l'ultima riga
  useEffect(() => {
    if (!regolazioneMode) return;
    if (selectedQuietanzaRefId) return;
    if (!quietanzePolizza || quietanzePolizza.length === 0) return;
    const incassate = quietanzePolizza.filter((q: any) => q.stato === "incassato" || q.data_messa_cassa);
    const target = incassate.length > 0 ? incassate[incassate.length - 1] : quietanzePolizza[quietanzePolizza.length - 1];
    if (target) setSelectedQuietanzaRefId(target.id);
  }, [regolazioneMode, quietanzePolizza, selectedQuietanzaRefId]);



  // Nascondi hint quando l'utente cambia compagnia manualmente
  useEffect(() => {
    if (!prefilledHint) return;
    // se cliente cambia o compagnia svuotata, nascondi
    if (!selectedCompagnia) setPrefilledHint(false);
  }, [selectedCompagnia, prefilledHint]);

  // Eredita ufficio dal cliente (solo se non già impostato manualmente o da bozza)
  useEffect(() => {
    if (clienteDettaglio?.ufficio_id && !selectedUfficioId) {
      setSelectedUfficioId(clienteDettaglio.ufficio_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteDettaglio?.ufficio_id]);

  // Tipo soggetto derivato dal Gruppo Finanziario del cliente (governa i campi obbligatori).
  // Fallback: se il GF non è ancora assegnato ma il cliente è marcato `tipo_cliente='ente'`,
  // consideralo comunque Ente così il campo CIG appare ed è obbligatorio.
  const tipoSoggetto: "privato" | "azienda" | "ente" | null = useMemo(() => {
    const gfRaw: any = clienteDettaglio?.gruppi_finanziari;
    const gf: any = Array.isArray(gfRaw) ? gfRaw[0] : gfRaw;
    const fromGf = (gf?.tipo_soggetto as any) ?? null;
    if (fromGf) return fromGf;
    const tc = clienteDettaglio?.tipo_cliente;
    if (tc === "ente") return "ente";
    if (tc === "azienda") return "azienda";
    if (tc === "privato") return "privato";
    return null;
  }, [clienteDettaglio]);
  const gruppoFinanziarioMancante = !!selectedClienteId && !tipoSoggetto;
  const cigObbligatorio = tipoSoggetto === "ente";
  const cigValido = !cigRif.trim() || isValidCigWithFlag(cigRif, cigTemporaneo);
  const saveBlockReason = !selectedClienteId
    ? "Seleziona prima un cliente"
    : gruppoFinanziarioMancante
      ? "Il cliente selezionato non ha un Gruppo Finanziario: aprilo nella scheda cliente e assegnalo prima di salvare la polizza"
      : !numeroPolizza.trim()
        ? "Il N° Polizza è obbligatorio"
        : (cigObbligatorio && !cigRif.trim())
          ? "Per i clienti di tipo Ente il CIG è obbligatorio"
          : (cigRif.trim() && !cigValido)
            ? "Il CIG deve essere di 10 caratteri alfanumerici (o spunta 'CIG temporaneo')"
            : null;

  // (eredità AE/Specialist/Produttore spostata sotto le query)

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

  // Account Executive: fonte canonica = anagrafiche_professionali (tipo='account_executive').
  // Indipendenti dalla Sede: lista globale di tutti gli AE attivi.
  const { data: aeLookupData } = useAccountExecutivesLookup();
  const aeAnagraficheList = aeLookupData?.options ?? [];

  // Eredita AE, Specialist e Produttore dal cliente
  useEffect(() => {
    if (!Array.isArray(clienteAE) || clienteAE.length === 0) return;
    const ae = clienteAE.find((c: any) => c.ruolo === "account_executive" || c.ruolo === "AE");
    const bo = clienteAE.find((c: any) => c.ruolo === "Backoffice");
    const prod = clienteAE.find((c: any) => c.ruolo === "Produttore Sede");

    // AE: prima prova anagrafica_id, poi fallback per nome verso aeAnagraficheList
    if (ae?.anagrafica_id) {
      setSelectedAccountExecutiveId(ae.anagrafica_id as string);
    } else if (ae && Array.isArray(aeAnagraficheList) && aeAnagraficheList.length > 0 && !selectedAccountExecutiveId) {
      const aeProfile: any = ae.profiles;
      if (aeProfile) {
        const target = `${aeProfile.cognome || ""} ${aeProfile.nome || ""}`.trim().toLowerCase();
        if (target) {
          const match = aeAnagraficheList.find((a) => a.label.trim().toLowerCase() === target);
          if (match?.value) setSelectedAccountExecutiveId(match.value);
        }
      }
    }

    if (bo?.profilo_id && !selectedBackofficeId) setSelectedBackofficeId(bo.profilo_id as string);

    // Produttore: prima anagrafica_id, poi fallback per nome verso aeList (anagrafiche corrispondenti)
    if (prod?.anagrafica_id) {
      setSelectedAE(prod.anagrafica_id as string);
    } else if (prod && Array.isArray(aeList) && aeList.length > 0 && !selectedAE) {
      const prodProfile: any = prod.profiles;
      if (prodProfile) {
        const target = `${prodProfile.cognome || ""} ${prodProfile.nome || ""}`.trim().toLowerCase();
        if (target) {
          const match = (aeList).find((a: any) => {
            const label = (a.ragione_sociale || `${a.cognome || ""} ${a.nome || ""}`).trim().toLowerCase();
            return label === target;
          });
          if (match?.id) setSelectedAE(match.id as string);
        }
      }
    }
  }, [clienteAE, aeList, aeAnagraficheList]);

  const { data: compagnieList } = useQuery({
    queryKey: ["agenzie-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("compagnie").select("id, nome, codice, gruppo_compagnia, gruppo_compagnia_id, tipo").eq("attiva", true).order("nome");
      return data || [];
    },
  });

  // Broker/Plurimandatarie che hanno un rapporto attivo con la compagnia (gruppo) scelta
  const { data: brokerPluriPerGruppo } = useQuery({
    queryKey: ["broker_pluri_per_gruppo", selectedGruppoCompagniaId],
    enabled: !!selectedGruppoCompagniaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnia_rapporti")
        .select("compagnia_id")
        .eq("gruppo_compagnia_id", selectedGruppoCompagniaId)
        .eq("attivo", true);
      const ids = Array.from(new Set(((data) || []).map((r) => r.compagnia_id).filter(Boolean)));
      return ids as string[];
    },
  });

  // Mappa completa compagnia (broker/pluri) → gruppi_compagnia coperti (per ricerca inversa)
  const { data: rapportiMap } = useQuery({
    queryKey: ["compagnia_rapporti_map_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnia_rapporti")
        .select("compagnia_id, gruppo_compagnia_id")
        .eq("attivo", true);
      const map = new Map<string, string[]>();
      for (const r of (data || []) as any[]) {
        if (!r.compagnia_id || !r.gruppo_compagnia_id) continue;
        const arr = map.get(r.compagnia_id) || [];
        if (!arr.includes(r.gruppo_compagnia_id)) arr.push(r.gruppo_compagnia_id);
        map.set(r.compagnia_id, arr);
      }
      return map;
    },
  });


  const { data: gruppiCompagniaList } = useQuery({
    queryKey: ["gruppi-compagnia-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("gruppi_compagnia").select("id, codice, descrizione").eq("attivo", true).order("descrizione");
      return ((data) || []).map((g: any) => ({ id: g.id, codice: g.codice, nome: `${g.codice ? g.codice + " - " : ""}${g.descrizione || ""}` }));
    },
  });

  const { data: ramiList } = useQuery({
    queryKey: ["rami-list-immissione"],
    queryFn: async () => {
      const { data } = await supabase.from("rami").select("id, codice, descrizione, gruppo_ramo_id, ssn_attivo, aliquota_ssn, aliquota_tasse_ramo, escludi_provvigioni").eq("attivo", true).order("codice");
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

  // Sync gruppo compagnia quando cambia agenzia
  useEffect(() => {
    if (!selectedCompagnia) return;
    const ag = (compagnieList || []).find((c: any) => c.id === selectedCompagnia);
    if (ag?.gruppo_compagnia_id && ag.gruppo_compagnia_id !== selectedGruppoCompagniaId) {
      setSelectedGruppoCompagniaId(ag.gruppo_compagnia_id);
    }
  }, [selectedCompagnia, compagnieList]);

  // Tipo dell'agenzia selezionata
  const selectedAgenzia = (compagnieList || []).find((c: any) => c.id === selectedCompagnia) as any;
  const tipoAgenzia = (selectedAgenzia?.tipo || "").toLowerCase();
  const isBrokerLike = tipoAgenzia === "broker" || tipoAgenzia === "plurimandataria";

  // Rapporti per l'agenzia selezionata, filtrati per gruppo compagnia
  const { data: rapportiAgenzia } = useQuery({
    queryKey: ["compagnia_rapporti_attivi", selectedCompagnia, selectedGruppoCompagniaId],
    enabled: !!selectedCompagnia && isBrokerLike && !!selectedGruppoCompagniaId,
    queryFn: async () => {
      const { data } = await supabase
        .from("compagnia_rapporti")
        .select("id, codice_rapporto, nome_rapporto, tipo_rapporto, gruppo_compagnia_id, attivo")
        .eq("compagnia_id", selectedCompagnia)
        .eq("gruppo_compagnia_id", selectedGruppoCompagniaId)
        .eq("attivo", true)
        .order("codice_rapporto");
      return (data) || [];
    },
  });

  // Auto-seleziona rapporto se broker/pluri con 1 solo rapporto coerente
  useEffect(() => {
    if (!isBrokerLike || !selectedCompagnia) {
      if (selectedRapportoId) setSelectedRapportoId("");
      return;
    }
    const list = rapportiAgenzia || [];
    if (list.length === 1) {
      if (selectedRapportoId !== list[0].id) setSelectedRapportoId(list[0].id);
    } else if (selectedRapportoId && !list.find((r: any) => r.id === selectedRapportoId)) {
      setSelectedRapportoId("");
    }
  }, [rapportiAgenzia, selectedCompagnia, isBrokerLike]);

  // Sync targa veicolo → campo legacy targa_telaio salvato in titoli (UI Targa è solo in sezione Veicolo)
  useEffect(() => {
    if (vTarga) setTargaTelaio(vTarga);
  }, [vTarga]);


  // Gruppo ramo selezionato (verità: selectedGruppoRamoId; selectedRamo derivato da righe garanzia in save)
  const selectedRamoData = ramiList?.find((r) => r.id === selectedRamo);
  const selectedGruppoRamo = gruppiRamo?.find((g) => g.id === selectedGruppoRamoId);

  // Detect RCA: gruppo ramo contiene "RCA" o "Auto" oppure checkbox polizzaAuto
  const isRCA = polizzaAuto || (selectedGruppoRamo?.descrizione || "").toUpperCase().includes("RCA") || (selectedGruppoRamo?.descrizione || "").toUpperCase().includes("AUTO");

  // Quando il ramo NON è auto, azzeriamo i dati veicolo/conducente per evitare
  // salvataggi sporchi — ma SOLO se non risultano dati già inseriti dall'utente
  // (altrimenti il toggle di polizzaAuto o il flip di isRCA dovuto al caricamento
  // asincrono di gruppiRamo cancellerebbe il lavoro in corso).
  useEffect(() => {
    if (isRCA) return;
    const hasUserData =
      premiFirmaRows.some((r) => r.netto || r.tasse || r.sottoramoId) ||
      premiQuietanzaRows.some((r) => r.netto || r.tasse || r.sottoramoId) ||
      !!vTarga || !!vMarca || !!vModello || !!vTelaio || !!targaTelaio;
    if (hasUserData) return;
    setTargaTelaio("");
    setVMarca(""); setVModello(""); setVVersione(""); setVTarga(""); setVTelaio("");
    setVDescrizione(""); setVDataImmatricolazione(""); setVAnnoAcquisto("");
    setVProvinciaCircolazione(""); setVClasseBm("");
    setVMass1("0"); setVMass2("0"); setVMass3("0");
    setVPeius(false); setVFranchigia("0"); setVTemporanea(false);
    setVCaricoScarico(false); setVCompetizione(false); setVRimorchio(false);
    setVCv("0"); setVKw("0"); setVCc("0"); setVPosti("0");
    setVPesoMotrice("0"); setVPesoRimorchio("0"); setVPesoTotale("0");
    setVTipologiaGuida(""); setVTipoAlimentazione("");
    setPremiFirmaRows([emptyGaranziaRow()]); setPremiQuietanzaRows([emptyGaranziaRow()]);
    setCNome(""); setCCognome(""); setCIndirizzo(""); setCCap("");
    setCCitta(""); setCProvincia(""); setCDataNascita("");
    setCTipoPatente(""); setCDataRilascioPatente(""); setCNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRCA]);


  // Provvigione: rimossa lookup automatica per prodotto (prodotto è ora testo libero).
  // L'utente inserisce manualmente la percentuale.
  const provvigioneFromDb = false;
  const isProvvigioneModified = false;

  // --- Computed: derive scalars from row arrays ---
  const sumNum = (arr: GaranziaRow[], k: "netto" | "tasse" | "ssn") =>
    arr.reduce((s, r) => s + (parseFloat(r[k] || "0") || 0), 0);
  const premioNettoNum = sumNum(premiFirmaRows, "netto");
  const tasseNum = sumNum(premiFirmaRows, "tasse");
  const ssnFirmaNum = sumNum(premiFirmaRows, "ssn");
  const premioNetto = premioNettoNum ? String(premioNettoNum) : "";
  const tasse = tasseNum ? String(tasseNum) : "";
  const premioNettoQNum = sumNum(premiQuietanzaRows, "netto");
  const tasseQNum = sumNum(premiQuietanzaRows, "tasse");
  const ssnQuietanzaNum = sumNum(premiQuietanzaRows, "ssn");
  const premioNettoQuietanza = premioNettoQNum ? String(premioNettoQNum) : "";
  const tasseQuietanza = tasseQNum ? String(tasseQNum) : "";

  const totFirma = premioNettoNum + (parseFloat(addizionali || "0") || 0) + tasseNum + ssnFirmaNum;
  const totQuietanza = premioNettoQNum + (parseFloat(addizionaliQuietanza || "0") || 0) + tasseQNum + ssnQuietanzaNum;

  // --- Matrice provvigioni per Rapporto + Gruppo Ramo: pct per sottoramo ---
  type MatriceProvv = {
    pctByRamoId: Map<string, number>;
    pctDefault: number | null;
    pctPrevalente: number;
    isUniform: boolean;
    totalRows: number;
  };
  const [provvMatrice, setProvvMatrice] = useState<MatriceProvv | null>(null);
  // Rapporto effettivo per matrice provvigioni: per monomandatarie deriva dalla coppia (compagnia, gruppo madre)
  const [resolvedRapportoId, setResolvedRapportoId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedCompagnia || !selectedGruppoCompagniaId) {
        if (!cancelled) setResolvedRapportoId(null);
        return;
      }
      if (isBrokerLike) {
        if (!cancelled) setResolvedRapportoId(selectedRapportoId || null);
        return;
      }
      const { data } = await supabase
        .from("compagnia_rapporti")
        .select("id")
        .eq("compagnia_id", selectedCompagnia)
        .eq("gruppo_compagnia_id", selectedGruppoCompagniaId)
        .eq("attivo", true)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setResolvedRapportoId(data?.id || null);
    })();
    return () => { cancelled = true; };
  }, [selectedCompagnia, selectedGruppoCompagniaId, selectedRapportoId, isBrokerLike]);

  const resolveRowPct = (row: GaranziaRow): { pct: number; matched: boolean } => {
    if (!provvMatrice) return { pct: 0, matched: false };
    if (row.sottoramoId && provvMatrice.pctByRamoId.has(row.sottoramoId)) {
      return { pct: provvMatrice.pctByRamoId.get(row.sottoramoId)!, matched: true };
    }
    if (provvMatrice.pctDefault != null) return { pct: provvMatrice.pctDefault, matched: true };
    return { pct: provvMatrice.pctPrevalente, matched: provvMatrice.isUniform };
  };

  const calcProvvAuto = (rows: GaranziaRow[]) =>
    rows.reduce((s, r) => {
      const netto = parseFloat(r.netto || "0") || 0;
      return s + (netto * resolveRowPct(r).pct) / 100;
    }, 0);

  const provvFirma = percentualeProvvigioneAuto
    ? calcProvvAuto(premiFirmaRows)
    : (percentualeProvvigione ? (premioNettoNum * parseFloat(percentualeProvvigione)) / 100 : 0);
  const provvQuietanza = percentualeProvvigioneAuto
    ? calcProvvAuto(premiQuietanzaRows)
    : (percentualeProvvigione ? (premioNettoQNum * parseFloat(percentualeProvvigione)) / 100 : 0);

  const brokFirma = percentualeBrokeraggio ? (premioNettoNum * parseFloat(percentualeBrokeraggio) / 100) : 0;
  const brokQuietanza = percentualeBrokeraggio ? (premioNettoQNum * parseFloat(percentualeBrokeraggio) / 100) : 0;

  // --- Auto-lookup % Commerciale Produttore in base al Ramo ---
  // Sorgente: produttori_provvigioni_ramo (anagrafica_id + ramo_codice) → fallback anagrafiche_professionali.percentuale_base
  useEffect(() => {
    if (!selectedAE) return;
    const ramoCodice = selectedRamoData?.codice;
    let cancelled = false;
    (async () => {
      try {
        let pct: number | null = null;
        if (ramoCodice) {
          const { data: ppr } = await supabase
            .from("produttori_provvigioni_ramo")
            .select("percentuale_provvigione")
            .eq("anagrafica_id", selectedAE)
            .eq("ramo_codice", ramoCodice)
            .maybeSingle();
          if (ppr && ppr.percentuale_provvigione != null) {
            pct = Number(ppr.percentuale_provvigione);
          }
        }
        if (pct == null) {
          const { data: ap } = await supabase
            .from("anagrafiche_professionali")
            .select("percentuale_base, percentuale_consulenza")
            .eq("id", selectedAE)
            .maybeSingle();
          if (ap?.percentuale_base != null) pct = Number(ap.percentuale_base);
          if (!cancelled && ap?.percentuale_consulenza != null) {
            setPercentualeBrokeraggio(String(Number(ap.percentuale_consulenza)));
            setPercentualeBrokeraggioAuto(true);
          }
        } else {
          // % commerciale presa dal ramo: leggo comunque la consulenza base del produttore
          const { data: ap2 } = await supabase
            .from("anagrafiche_professionali")
            .select("percentuale_consulenza")
            .eq("id", selectedAE)
            .maybeSingle();
          if (!cancelled && ap2?.percentuale_consulenza != null) {
            setPercentualeBrokeraggio(String(Number(ap2.percentuale_consulenza)));
            setPercentualeBrokeraggioAuto(true);
          }
        }
        if (!cancelled && pct != null && !Number.isNaN(pct)) {
          setPercentualeCommerciale(String(pct));
          setPercentualeCommercialeAuto(true);
        }
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [selectedAE, selectedRamoData?.codice]);

  // --- Matrice Provvigioni (Rapporto + Gruppo Ramo) caricata una sola volta ---
  useEffect(() => {
    setPercentualeProvvigioneAuto(true);
  }, [resolvedRapportoId, selectedGruppoRamoId]);

  useEffect(() => {
    if (!resolvedRapportoId || !selectedGruppoRamoId) {
      setProvvMatrice(null);
      setProvvigioneFonte("");
      setProvvigioneWarning("");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("provvigioni_compagnia_ramo")
        .select("ramo_id, percentuale_provvigione")
        .eq("compagnia_rapporto_id", resolvedRapportoId)
        .eq("gruppo_ramo_id", selectedGruppoRamoId)
        .eq("attiva", true);
      if (cancelled) return;
      const rows = (data || []) as Array<{ ramo_id: string | null; percentuale_provvigione: number }>;
      if (!rows.length) {
        setProvvMatrice(null);
        setProvvigioneFonte("");
        setProvvigioneWarning("Nessuna provvigione configurata per Compagnia/Agenzia + Ramo selezionati.");
        return;
      }
      const pctByRamoId = new Map<string, number>();
      let pctDefault: number | null = null;
      const counts = new Map<number, number>();
      for (const r of rows) {
        const p = Number(r.percentuale_provvigione);
        if (r.ramo_id) pctByRamoId.set(r.ramo_id, p);
        else pctDefault = p;
        counts.set(p, (counts.get(p) || 0) + 1);
      }
      let bestP = 0, bestC = 0;
      for (const [p, c] of counts) if (c > bestC) { bestC = c; bestP = p; }
      const isUniform = counts.size === 1;
      setProvvMatrice({ pctByRamoId, pctDefault, pctPrevalente: bestP, isUniform, totalRows: rows.length });
      setProvvigioneFonte(
        isUniform
          ? `matrice ${rows.length} sottorami al ${bestP}% (uniforme)`
          : `matrice ${rows.length} sottorami — % calcolata per riga sul sottoramo`
      );
    })();
    return () => { cancelled = true; };
  }, [resolvedRapportoId, selectedGruppoRamoId]);

  // Sincronizza display % Agenzia (media ponderata) + warning quando in auto
  useEffect(() => {
    if (!percentualeProvvigioneAuto) return;
    const totNetto = premioNettoNum + premioNettoQNum;
    if (provvMatrice && totNetto > 0) {
      const avg = ((provvFirma + provvQuietanza) / totNetto) * 100;
      const rounded = String(Math.round(avg * 1000) / 1000);
      setPercentualeProvvigione((prev) => (prev === rounded ? prev : rounded));
    } else if (!provvMatrice) {
      setPercentualeProvvigione((prev) => (prev === "" ? prev : ""));
    }
    if (provvMatrice && !provvMatrice.isUniform) {
      const allRows = [...premiFirmaRows, ...premiQuietanzaRows].filter(
        (r) => (parseFloat(r.netto || "0") || 0) > 0
      );
      const unmatched = allRows.some((r) => !resolveRowPct(r).matched);
      const msg = unmatched
        ? "Alcune righe usano l'aliquota prevalente — seleziona il Sottoramo per la % esatta."
        : "";
      setProvvigioneWarning((prev) => (prev === msg ? prev : msg));
    }
  }, [percentualeProvvigioneAuto, provvMatrice, premioNettoNum, premioNettoQNum, provvFirma, provvQuietanza, premiFirmaRows, premiQuietanzaRows]);

  // --- Frazionamento helpers + auto-calcolo Periodo ---
  const FRAZIONAMENTO_OPTIONS = [
    { value: "Mensile", label: "Mensile" },
    { value: "Trimestrale", label: "Trimestrale" },
    { value: "Quadrimestrale", label: "Quadrimestrale" },
    { value: "Semestrale", label: "Semestrale" },
    { value: "Annuale", label: "Annuale" },
    { value: "Poliennale", label: "Poliennale" },
  ];
  const frazionamentoMesi = (f: string, anni: number): number => {
    switch (f) {
      case "Mensile": return 1;
      case "Trimestrale": return 3;
      case "Quadrimestrale": return 4;
      case "Semestrale": return 6;
      case "Poliennale": return Math.max(1, anni) * 12;
      case "Annuale":
      default: return 12;
    }
  };
  const frazionamentoToRate = (f: string, anni: number): number => {
    if (f === "Poliennale") return 1;
    const m = frazionamentoMesi(f, anni);
    return Math.max(1, Math.round(12 / m));
  };
  const addMonthsISO = (iso: string, months: number): string => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return "";
    const dt = new Date(Date.UTC(y, m - 1 + months, d));
    return dt.toISOString().slice(0, 10);
  };
  useEffect(() => {
    if (!durataDa) return;
    const anni = Math.max(1, parseInt(anniDurata) || 1);
    const mesiGar = frazionamentoMesi(frazionamento, anni);
    if (!durataATouched) setDurataA(addMonthsISO(durataDa, anni * 12));
    if (!garanziaDaTouched) setGaranziaDa(durataDa);
    if (!garanziaATouched) setGaranziaA(addMonthsISO(durataDa, mesiGar));
    if (!dataCompetenzaTouched) setDataCompetenza(durataDa);
    if (!limiteMoraTouched) {
      const base = (!dataCompetenzaTouched ? durataDa : (dataCompetenza || durataDa));
      const gg = parseInt(moraGiorni || "0") || 0;
      if (base) {
        const d = new Date(base); d.setDate(d.getDate() + gg);
        setLimiteMora(d.toISOString().slice(0, 10));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durataDa, anniDurata, frazionamento]);

  // --- Handlers ---

  const handleConferma = () => {
    finalizzaPolizza();
  };

  const finalizzaPolizza = async () => {
    if (saving) return;
    // Deriva ramo_id (sottoramo) dalla prima riga garanzia non vuota
    const firstSottoramoId =
      premiFirmaRows.find((r) => r.sottoramoId)?.sottoramoId ||
      premiQuietanzaRows.find((r) => r.sottoramoId)?.sottoramoId ||
      null;
    const ramoIdToSave = firstSottoramoId || selectedRamo || null;
    if (!selectedGruppoRamoId) {
      toast.error("Seleziona il Ramo");
      return;
    }
    if (!ramoIdToSave) {
      toast.error("Aggiungi almeno una garanzia/sottoramo nelle Composizioni Premio");
      return;
    }
    if (!selectedGruppoCompagniaId) {
      toast.error("Seleziona la Compagnia Assicurativa");
      return;
    }
    if (!selectedCompagnia) {
      toast.error("Seleziona l'Agenzia di Riferimento");
      return;
    }
    if (isBrokerLike && !selectedRapportoId) {
      toast.error("Seleziona il Rapporto Agenzia");
      return;
    }
    if (isRCA) {
      if (!vTipoVeicolo) { toast.error("Tipo Veicolo obbligatorio per RCA Auto"); return; }
      if (!vTarga) { toast.error("Targa obbligatoria per RCA Auto"); return; }
      if (!vUso) { toast.error("Uso obbligatorio per RCA Auto"); return; }
      if (!vTipologiaGuida) { toast.error("Tipologia Guida obbligatoria per RCA Auto"); return; }
    }
    const rapportoSel = (rapportiAgenzia || []).find((r: any) => r.id === selectedRapportoId);
    setSaving(true);
    try {
      // In modalità regolazione la nuova riga deve essere riga+1 rispetto all'ultima del numero_titolo
      let regolazioneRiga = 0;
      let regolazioneNote: string | null = null;
      if (regolazioneMode && polizzaMadre?.numero_titolo) {
        const { data: siblings } = await supabase
          .from("titoli")
          .select("riga")
          .eq("numero_titolo", polizzaMadre.numero_titolo);
        const maxRiga = Math.max(
          0,
          ...((siblings || []).map((s: any) => Number(s.riga || 0))),
          Number(polizzaMadre.riga || 0),
        );
        regolazioneRiga = maxRiga + 1;
        const today = new Date().toISOString().slice(0, 10);
        regolazioneNote = `Regolazione premio del ${today.split("-").reverse().join("/")} — polizza madre rg.${polizzaMadre.riga ?? 0}`;
      }
      const payload: Record<string, any> = {
        numero_titolo: numeroPolizza || null,
        riga: regolazioneMode ? regolazioneRiga : 0,
        appendice: "000",
        // gruppo_compagnia_id non è una colonna di titoli: si deriva via compagnia_rapporti
        compagnia_id: selectedCompagnia || null,
        compagnia_rapporto_id: isBrokerLike ? (selectedRapportoId || null) : null,
        codice_rapporto: isBrokerLike ? (rapportoSel?.codice_rapporto || null) : null,
        ramo_id: ramoIdToSave,
        prodotto_nome: prodottoNome || null,
        cliente_anagrafica_id: selectedClienteId || null,
        
        // CIG solo per Enti: per Privati/Aziende lo forziamo a null per non lasciare residui se l'utente cambia cliente
        cig_rif: tipoSoggetto === "ente" && cigRif ? normalizeCig(cigRif) : null,
        cig_temporaneo: tipoSoggetto === "ente" ? cigTemporaneo : false,
        vincolo: vincolo || null,
        targa_telaio: targaTelaio || null,
        descrizione_polizza: descrizionePolizza || null,
        durata_da: durataDa || null,
        durata_a: durataA || null,
        anni_durata: parseInt(anniDurata) || 1,
        tacito_rinnovo: tacitoRinnovo,
        periodicita,
        rate: frazionamentoToRate(frazionamento, parseInt(anniDurata) || 1),
        frazionamento,
        mora_giorni: parseInt(moraGiorni) || 15,
        premio_netto: premioNetto ? parseFloat(premioNetto) : null,
        addizionali: addizionali ? parseFloat(addizionali) : 0,
        tasse: tasse ? parseFloat(tasse) : null,
        ssn_firma: ssnFirmaNum || 0,
        premio_lordo: totFirma || null,
        valuta,
        provvigioni_firma: provvFirma || null,
        
        commerciale_id: selectedCommerciale === "__sede__" ? null : selectedCommerciale,
        percentuale_commerciale: parseFloat(percentualeCommerciale) || 100,
        percentuale_ae: parseFloat(percentualeAE) || 0,
        garanzia_da: garanziaDa || null,
        garanzia_a: garanziaA || null,
        data_competenza: dataCompetenza || null,
        limite_mora: limiteMora || null,
        disdetta_mesi: disdettaMesi ? parseInt(disdettaMesi) : null,
        regolazione,
        tipo_lettera_regolazione: tipoLetteraRegolazione || null,
        tipo_scadenza: tipoScadenza,
        giorni_presentazione: giorniPresentazione ? parseInt(giorniPresentazione) : null,
        libro_matricola: isLibroMatricola ? "auto" : libroMatricola,
        premio_netto_quietanza: premioNettoQuietanza ? parseFloat(premioNettoQuietanza) : null,
        addizionali_quietanza: addizionaliQuietanza ? parseFloat(addizionaliQuietanza) : null,
        tasse_quietanza: tasseQuietanza ? parseFloat(tasseQuietanza) : null,
        ssn_quietanza: ssnQuietanzaNum || 0,
        provvigioni_quietanza: provvQuietanza || null,
        brokeraggio_firma: brokFirma || null,
        brokeraggio_quietanza: brokQuietanza || null,
        percentuale_brokeraggio: percentualeBrokeraggio ? parseFloat(percentualeBrokeraggio) : null,
        rimborso, indicizzata, no_calcolo_tasse: noCalcoloTasse,
        pag_diretto_compagnia: pagDirettoCompagnia, emissione_fee: emissioneFee,
        formato_elettronico: formatoElettronico,
        cambio: parseFloat(cambio) || 1,
        // Incasso/Copertura: NON valorizzati in immissione — verranno settati dal flusso "Messa a Cassa" su TitoloDetail.
        stato: "attivo",
        ufficio_id: selectedUfficioId || profile?.ufficio_id || null,
        // Produttore: salviamo l'anagrafica + nome leggibile (produttore_id legacy resta NULL).
        anagrafica_commerciale_id: selectedAE || null,
        produttore_nome: (() => {
          if (!selectedAE) return null;
          const ae = (aeList || []).find((a: any) => a.id === selectedAE);
          if (!ae) return null;
          return ae.ragione_sociale || `${ae.cognome || ""} ${ae.nome || ""}`.trim() || null;
        })(),
        // Account Executive: anagrafica + nome leggibile.
        ae_anagrafica_id: selectedAccountExecutiveId || null,
        ae_nome: (() => {
          if (!selectedAccountExecutiveId) return null;
          const a = (aeAnagraficheList || []).find((x) => x.value === selectedAccountExecutiveId);
          return a ? a.label : null;
        })(),
        // Backoffice (Specialist) salvato come "COGNOME NOME" leggibile in titoli.specialist
        ...(selectedBackofficeId ? {
          specialist: (() => {
            const b = (backofficeList || []).find((x: any) => x.id === selectedBackofficeId);
            return b ? `${b.cognome || ""} ${b.nome || ""}`.trim() : null;
          })(),
        } : {}),
      };

      // In modalità regolazione: agganciamo polizza madre e note
      if (regolazioneMode && polizzaMadre) {
        payload.sostituisce_polizza = polizzaMadre.numero_titolo;
        payload.sostituisce_riga = polizzaMadre.riga;
        payload.note = regolazioneNote;
      }

      const { data: newTitolo, error } = await supabase
        .from("titoli")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;

      // Create first movimento ("Polizza Base" oppure "Regolazione Premio")
      await supabase.from("movimenti_polizza").insert({
        titolo_id: newTitolo.id,
        riga: regolazioneMode ? regolazioneRiga : 0,
        appendice: "000",
        data_movimento: new Date().toISOString().split("T")[0],
        data_effetto: durataDa || null,
        data_scadenza: durataA || null,
        tacito_rinnovo: tacitoRinnovo,
        descrizione: regolazioneMode
          ? (regolazioneNote || "Regolazione premio")
          : (cigRif ? `CIG: ${cigRif}` : descrizionePolizza || null),
        valuta,
        premio: totFirma || 0,
        provvigioni: provvFirma || 0,
        tipo: regolazioneMode ? "Regolazione Premio" : "Polizza Base",
        incassato: false,
        stato: "attivo",
        ufficio_id: selectedUfficioId || profile?.ufficio_id || null,
      } as any);

      // Libro Matricola: salva righe mezzi (solo se Tipo Operazione = libro_matricola)
      if (isLibroMatricola) {
        const righeValide = filterRigheValide(righeMatricola);
        if (righeValide.length > 0) {
          const { error: lmErr } = await supabase.from("libro_matricola_mezzi").insert(
            righeValide.map((r) => ({
              titolo_id: newTitolo.id,
              targa: r.targa?.trim() || null,
              data_inclusione: r.data_inclusione || null,
              data_esclusione: r.data_esclusione || null,
              note: r.note?.trim() || null,
            }))
          );
          if (lmErr) console.error("Errore salvataggio mezzi libro matricola:", lmErr);
        }
      }

      // Snapshot regolazione (collegamento con polizza madre + quietanza di riferimento)
      if (regolazioneMode && polizzaMadre) {
        await supabase.from("titoli_regolazioni").insert({
          titolo_madre_id: polizzaMadre.id,
          titolo_regolazione_id: newTitolo.id,
          quietanza_riferimento_id: selectedQuietanzaRefId || null,
          data_regolazione: new Date().toISOString().slice(0, 10),
          periodo_da: durataDa || null,
          periodo_a: durataA || null,
          conguaglio_premio: totFirma || 0,
          note: regolazioneNote,
          created_by: user?.id || null,
        } as any);

        // Movimento RG sulla polizza madre (per timeline)
        await supabase.from("movimenti_polizza").insert({
          titolo_id: polizzaMadre.id,
          tipo_documento: "RG",
          data_movimento: new Date().toISOString().slice(0, 10),
          descrizione: `Regolazione premio — nuovo titolo riga ${regolazioneRiga}, conguaglio ${(totFirma || 0).toFixed(2)} €`,
          stato: polizzaMadre.stato,
        } as any);
      }

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

      // Premi garanzia (Firma + Quietanza) — vale per qualunque ramo
      const buildPremiInsert = (rows: GaranziaRow[], tipo: "firma" | "quietanza") =>
        rows
          .filter((r) => !!(r.sottoramoId || r.codice || r.descrizione.trim()))
          .map((r, idx) => ({
            titolo_id: newTitolo.id,
            tipo_premio: tipo,
            garanzia: (r.descrizione && r.descrizione.trim()) || r.codice || "Premio",
            codice_garanzia: r.codice || null,
            // ramo_id: r.sottoramoId || null,  // colonna non presente in premi_garanzia_polizza; il link si fa via codice_garanzia
            capitale: 0,
            tasso: 0,
            firma: tipo === "firma" ? parseFloat(r.netto || "0") || 0 : 0,
            rata: tipo === "quietanza" ? parseFloat(r.netto || "0") || 0 : 0,
            annuo: 0,
            ordine: idx,
            aliquota_tasse_pct: r.aliquotaTasse || null,
            ssn: parseFloat(r.ssn || "0") || 0,
          }));
      const premiPayload = [
        ...buildPremiInsert(premiFirmaRows, "firma"),
        ...buildPremiInsert(premiQuietanzaRows, "quietanza"),
      ];
      if (premiPayload.length > 0) {
        await supabase.from("premi_garanzia_polizza").insert(premiPayload);
      }

      // Applica drafts delle Quietanze (rate editate riga-per-riga nel form):
      // il trigger DB ha già creato le quietanze in base a polizza+frazionamento.
      // Qui sovrascriviamo i campi editati dall'utente per ogni rata.
      if (!regolazioneMode && quietanzeDrafts.length > 0) {
        try {
          const { data: titoloRow } = await supabase
            .from("titoli")
            .select("polizza_id")
            .eq("id", newTitolo.id)
            .single();
          const polizzaId = (titoloRow as any)?.polizza_id;
          if (polizzaId) {
            for (const d of quietanzeDrafts) {
              const patch = {
                garanzia_da: d.garanzia_da || null,
                garanzia_a: d.garanzia_a || null,
                data_competenza: d.data_competenza || null,
                data_scadenza: d.data_scadenza || null,
                premio_netto: parseFloat(d.premio_netto) || 0,
                tasse: parseFloat(d.tasse) || 0,
                ssn: parseFloat(d.ssn) || 0,
                addizionali: parseFloat(d.addizionali) || 0,
                premio_lordo: parseFloat(d.premio_lordo) || 0,
                provvigioni_firma: parseFloat(d.provvigioni_firma) || 0,
                provvigioni_quietanza: parseFloat(d.provvigioni_quietanza) || 0,
              };
              await (supabase.from("quietanze") as any)
                .update(patch)
                .eq("polizza_id", polizzaId)
                .eq("numero_rata", d.idx);
            }
          }
        } catch (e) {
          console.error("Errore applicazione drafts quietanze:", e);
        }
      }




      // Archivia il PDF della scansione AI fra i documenti della polizza
      if (aiSourcePdf) {
        try {
          const bin = atob(aiSourcePdf.base64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const safeName =
            (aiSourcePdf.name || `polizza-${numeroPolizza || newTitolo.id}.pdf`)
              .replace(/\s+/g, "_")
              .replace(/[^\w.\-]/g, "");
          const path = `${newTitolo.id}/${Date.now()}_${safeName}`;
          const { error: upErr } = await supabase.storage
            .from("documenti_titoli")
            .upload(path, bytes, { contentType: aiSourcePdf.mimeType || "application/pdf", upsert: true });
          if (upErr) throw upErr;
          const { error: docErr } = await supabase.from("documenti").insert({
            entita_tipo: "titolo",
            entita_id: newTitolo.id,
            bucket_name: "documenti_titoli",
            path_storage: path,
            nome_file: safeName,
            categoria: "polizza_originale",
            visibile_al_cliente: false,
          } as any);
          if (docErr) throw docErr;
        } catch (e: any) {
          console.error("Archiviazione PDF AI fallita:", e);
          toast.warning("Polizza creata ma archiviazione PDF AI fallita: " + (e?.message || "errore"));
        }
      }

      toast.success("Polizza registrata con successo");
      clearDraft(draftKey);
      setAiSourcePdf(null);
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {regolazioneMode ? "Regolazione Premio" : "Immissione Polizza"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {regolazioneMode
              ? "Conguaglio premio collegato a una polizza esistente — verrà creato un nuovo titolo RG"
              : "Inserimento nuova polizza nel portafoglio"}
          </p>
          {!regolazioneMode && (
            <p className="text-[11px] text-teal-700 dark:text-teal-300 mt-1 italic">
              ℹ️ Modello Polizza/Quietanza attivo: al salvataggio viene creata 1 <b>Polizza-Contratto</b> + N <b>Quietanze</b> in base al frazionamento. La polizza rappresenta il contratto, le quietanze sono le rate che si mettono a cassa.
            </p>
          )}

        </div>
        <Button
          type="button"
          onClick={() => setAiImportOpen(true)}
          className="gap-2 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800"
        >
          <Sparkles className="h-4 w-4" />
          Importa da PDF (AI)
        </Button>
      </div>

      {draftRestoredAt && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
          <span>
            Bozza ripristinata del{" "}
            {new Date(draftRestoredAt).toLocaleString("it-IT", {
              day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
            })}
            . Le modifiche vengono salvate automaticamente nel browser.
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => {
              clearDraft(draftKey);
              setDraftRestoredAt(null);
              window.location.reload();
            }}
          >
            Scarta bozza
          </Button>
        </div>
      )}

      {regolazioneMode && (
        <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm">
              <span className="font-semibold text-amber-900 dark:text-amber-200">
                Regolazione della polizza N° {polizzaMadre?.numero_titolo || "—"}
              </span>
              {polizzaMadre?.riga != null && (
                <span className="text-xs text-amber-800/80 dark:text-amber-300/80 ml-2">
                  (riga madre {polizzaMadre.riga})
                </span>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                if (titoloMadreId) navigate(`/titoli/${titoloMadreId}`);
                else navigate(-1);
              }}
            >
              Esci dalla regolazione
            </Button>
          </div>
          {(() => {
            const cli: any = (polizzaMadre as any)?.cliente;
            const clienteLabel = cli?.ragione_sociale || [cli?.cognome, cli?.nome].filter(Boolean).join(" ") || "—";
            const compagniaLabel = (polizzaMadre as any)?.compagnia?.nome || "—";
            const rap: any = (polizzaMadre as any)?.rapporto;
            const rapportoLabel = rap ? [rap.codice_rapporto, rap.nome_rapporto || rap.tipo_rapporto].filter(Boolean).join(" · ") : "—";
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs bg-white/60 dark:bg-amber-900/20 rounded px-3 py-2 border border-amber-300/60">
                <div><span className="text-amber-800/70 dark:text-amber-300/70">Polizza N°</span><div className="font-medium">{polizzaMadre?.numero_titolo || "—"}</div></div>
                <div><span className="text-amber-800/70 dark:text-amber-300/70">Cliente</span><div className="font-medium truncate" title={clienteLabel}>{clienteLabel}</div></div>
                <div><span className="text-amber-800/70 dark:text-amber-300/70">Compagnia</span><div className="font-medium truncate" title={compagniaLabel}>{compagniaLabel}</div></div>
                <div><span className="text-amber-800/70 dark:text-amber-300/70">Rapporto</span><div className="font-medium truncate" title={rapportoLabel}>{rapportoLabel}</div></div>
              </div>
            );
          })()}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Quietanza di riferimento *</Label>
              <SearchableSelect
                className="h-8 text-xs"
                value={selectedQuietanzaRefId}
                onValueChange={(v) => setSelectedQuietanzaRefId(v)}
                placeholder="— Seleziona la quietanza —"
                options={(quietanzePolizza || []).map((q: any) => {
                  const da = q.durata_da ? new Date(q.durata_da).toLocaleDateString("it-IT") : "—";
                  const a = q.durata_a ? new Date(q.durata_a).toLocaleDateString("it-IT") : "—";
                  const incassata = q.stato === "incassato" || q.data_messa_cassa ? " · INCASSATA" : "";
                  return {
                    value: q.id,
                    label: `Riga ${q.riga ?? 0} · ${da} → ${a} · ${q.stato || "—"}${incassata}`,
                  };
                })}
              />
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                La regolazione verrà collegata a questa quietanza nella tabella titoli_regolazioni.
              </p>
            </div>
          </div>
        </div>
      )}





      <ImportNuovaPolizzaAIDialog
        open={aiImportOpen}
        onOpenChange={setAiImportOpen}
        onApply={handleAIImportApply}
        lockedClienteId={preselectedClienteId || undefined}
        lockedClienteLabel={
          clienteDettaglio
            ? (clienteDettaglio.ragione_sociale ||
                `${clienteDettaglio.cognome || ""} ${clienteDettaglio.nome || ""}`.trim() ||
                undefined)
            : undefined
        }
      />

      {/* CLIENTE */}
      <PolizzaSection title="Cliente & Sede" icon={Users}>

        {/* Selezione cliente esistente */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente esistente</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedClienteId}
              onValueChange={(v) => setSelectedClienteId(v)}
              placeholder="— Cerca cliente per nome, CF o P.IVA —"
              searchValue={clienteSearch}
              onSearchChange={setClienteSearch}
              searchPlaceholder="Cerca per nome, CF o P.IVA…"
              emptyText={clienteSearch.length < 2 ? "Digita almeno 2 caratteri" : "Nessun cliente trovato"}
              options={(clientiSearchResults || []).map((c: any) => ({
                value: c.id,
                label: c.ragione_sociale
                  ? `${c.ragione_sociale}${c.partita_iva ? ` — P.IVA ${c.partita_iva}` : ""}`
                  : `${c.cognome || ""} ${c.nome || ""}${c.codice_fiscale ? ` — CF ${c.codice_fiscale}` : ""}`.trim(),
              }))}
            />
          </div>
          <NuovoClienteDialog
            key={nuovoClienteNonce}
            trigger={
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                Nuovo Cliente
              </Button>
            }
            controlledOpen={nuovoClienteOpen || undefined}
            onOpenChange={(o) => {
              setNuovoClienteOpen(o);
              if (!o) setAiClientePrefill(null);
            }}
            initialData={aiClientePrefill ?? undefined}
            onCreated={(id, label) => {
              setSelectedClienteId(id);
              setClienteSearch(label);
              setAiClientePrefill(null);
              setNuovoClienteOpen(false);
            }}
          />
        </div>

        {/* Badge Gruppo Finanziario del cliente selezionato */}
        {clienteDettaglio && (() => {
          const gf: any = clienteDettaglio.gruppi_finanziari;
          if (!gf) {
            return (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs flex items-center gap-2">
                <span className="text-destructive font-medium">⚠ Gruppo finanziario mancante</span>
                <span className="text-muted-foreground">— Apri la scheda cliente per assegnarlo (determina i campi obbligatori).</span>
              </div>
            );
          }
          const tipo = gf.tipo_soggetto as string;
          const cls =
            tipo === "privato" ? "border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/30" :
            tipo === "azienda" ? "border-emerald-600 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30" :
            "border-amber-600 text-amber-700 bg-amber-50 dark:bg-amber-950/30";
          const label = tipo === "privato" ? "Privato" : tipo === "azienda" ? "Azienda" : "Ente";
          return (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Gruppo Finanziario:</span>
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-medium ${cls}`}>
                {label} · {gf.codice} {gf.nome}
              </span>
            </div>
          );
        })()}

        {/* Conferma cliente selezionato */}
        {clienteDettaglio && (
          <p className="text-sm text-foreground font-medium">
            ✓ {clienteDettaglio.ragione_sociale || `${clienteDettaglio.cognome || ""} ${clienteDettaglio.nome || ""}`.trim()}
          </p>
        )}

        {/* Ufficio (Sede) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Sede (Ufficio) *</Label>
            <SearchableSelect
              className="h-8 text-xs w-full"
              value={selectedUfficioId}
              onValueChange={setSelectedUfficioId}
              placeholder="— Seleziona sede —"
              clearable
              options={(ufficiList || []).map((u: any) => ({
                value: u.id,
                label: `${u.codice_ufficio ? u.codice_ufficio + " - " : ""}${u.nome_ufficio}`,
              }))}
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Account Executive</Label>
            <SearchableSelect
              className="h-8 text-xs w-full"
              value={selectedAccountExecutiveId}
              onValueChange={setSelectedAccountExecutiveId}
              placeholder="— Seleziona Account Executive —"
              clearable
              options={aeAnagraficheList}
            />
          </div>
          <div className="space-y-1.5 min-w-0">

            <Label className="text-xs">Produttore</Label>
            <SearchableSelect
              className="h-8 text-xs w-full"
              value={selectedAE}
              onValueChange={setSelectedAE}
              placeholder="— Seleziona produttore —"
              clearable
              options={(aeList || []).map((ae: any) => ({
                value: ae.id,
                label: ae.ragione_sociale || `${ae.sigla || ae.codice || ""} - ${ae.cognome || ""} ${ae.nome || ""}`.trim(),
              }))}
            />
          </div>
          <div className="space-y-1.5 min-w-0">
            <Label className="text-xs">Specialist</Label>
            <SearchableSelect
              className="h-8 text-xs w-full"
              value={selectedBackofficeId}
              onValueChange={setSelectedBackofficeId}
              placeholder="— Seleziona Specialist —"
              clearable
              options={(backofficeList || []).map((b: any) => ({
                value: b.id,
                label: `${b.cognome || ""} ${b.nome || ""}`.trim(),
              }))}
            />
          </div>
        </div>
      </PolizzaSection>


      {/* TIPO — in cima perché determina i campi successivi */}
      <PolizzaSection title="Tipo Polizza" icon={Tag}>
        <div className="space-y-3">
          <Label className="text-xs">Tipo Operazione</Label>
          <RadioGroup value={tipoOperazione} onValueChange={setTipoOperazione} className="flex flex-wrap gap-4">
            {[
              { value: "polizza", label: "Polizza" },
              { value: "emittenda", label: "Emittenda" },
              { value: "libro_matricola", label: "Polizza Libro Matricola" },
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
        {isLibroMatricola && (
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMatricolaDialogOpen(true)}
              className="text-xs border-primary/40 text-primary hover:bg-primary/5"
            >
              <Truck className="h-3.5 w-3.5 mr-1.5" />
              Gestisci Libro Matricola ({filterRigheValide(righeMatricola).length} mezzi)
            </Button>
          </div>
        )}
      </PolizzaSection>

      {/* CONTRATTO */}
      <PolizzaSection
        title="Contratto"
        icon={FileText}
        headerExtra={
          (selectedGruppoCompagniaId || selectedCompagnia || selectedRapportoId) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-teal-700 hover:text-teal-900 hover:bg-teal-100"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedGruppoCompagniaId("");
                setSelectedCompagnia("");
                setSelectedRapportoId("");
              }}
            >
              <X className="w-3.5 h-3.5 mr-1" /> Azzera
            </Button>
          ) : null
        }
      >




        {prefilledHint && (
          <div className="mb-2 text-[11px] text-teal-700 bg-teal-50 border border-teal-200 rounded px-2 py-1 inline-block">
            Compagnia e Agenzia precompilate dall'ultima polizza di questo cliente — modificabili
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Compagnia Assicurativa <span className="text-destructive">*</span></Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedGruppoCompagniaId}
              onValueChange={(v) => {
                setSelectedGruppoCompagniaId(v);
                // resetta agenzia/rapporto se non più coerenti
                const ag = (compagnieList || []).find((c: any) => c.id === selectedCompagnia) as any;
                if (ag && v) {
                  const tipo = (ag.tipo || "").toLowerCase();
                  if ((tipo === "agenzia" || tipo === "direzione") && ag.gruppo_compagnia_id !== v) {
                    setSelectedCompagnia("");
                    setSelectedRapportoId("");
                  } else if (tipo === "broker" || tipo === "plurimandataria") {
                    // l'agenzia broker/pluri resta valida solo se ha rapporti col nuovo gruppo: la verifica sarà fatta al cambio rapporto
                    setSelectedRapportoId("");
                  }
                }
              }}
              placeholder={
                (gruppiCompagniaList || []).length === 0
                  ? "Caricamento compagnie…"
                  : "— Seleziona compagnia —"
              }
              options={(() => {
                // Se è già selezionata un'agenzia broker/pluri con più gruppi, restringi alle sole compagnie compatibili
                const ag = (compagnieList || []).find((c: any) => c.id === selectedCompagnia) as any;
                const tipoSel = (ag?.tipo || "").toLowerCase();
                let allowed: string[] | null = null;
                if (ag && (tipoSel === "broker" || tipoSel === "plurimandataria")) {
                  allowed = rapportiMap?.get(selectedCompagnia) || [];
                }
                return (gruppiCompagniaList || [])
                  .filter((g: any) => !allowed || allowed.includes(g.id))
                  .map((g: any) => ({
                    value: g.id,
                    label: g.nome || g.codice || "—",
                  }));
              })()}

            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Agenzia di Riferimento <span className="text-destructive">*</span></Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={selectedCompagnia}
              onValueChange={(v) => {
                setSelectedCompagnia(v);
                setSelectedRapportoId("");
                const ag = (compagnieList || []).find((c: any) => c.id === v) as any;
                const tipo = (ag?.tipo || "").toLowerCase();
                if ((tipo === "agenzia" || tipo === "direzione") && ag?.gruppo_compagnia_id) {
                  // agenzia/direzione → auto-set compagnia madre
                  setSelectedGruppoCompagniaId(ag.gruppo_compagnia_id);
                } else if (tipo === "broker" || tipo === "plurimandataria") {
                  // broker/pluri → se ha 1 solo gruppo, auto-set; altrimenti l'utente sceglie la compagnia
                  const gruppi = rapportiMap?.get(v) || [];
                  if (gruppi.length === 1) {
                    setSelectedGruppoCompagniaId(gruppi[0]);
                  } else if (gruppi.length > 1 && selectedGruppoCompagniaId && !gruppi.includes(selectedGruppoCompagniaId)) {
                    setSelectedGruppoCompagniaId("");
                  }
                }
              }}
              placeholder="— Cerca agenzia / broker —"
              options={(compagnieList || [])
                .filter((c: any) => {
                  const tipo = (c.tipo || "").toLowerCase();
                  // Se è già scelta una compagnia, applica il filtro classico
                  if (selectedGruppoCompagniaId) {
                    if (tipo === "agenzia" || tipo === "direzione") {
                      return c.gruppo_compagnia_id === selectedGruppoCompagniaId;
                    }
                    if (tipo === "broker" || tipo === "plurimandataria") {
                      return (brokerPluriPerGruppo || []).includes(c.id);
                    }
                    return false;
                  }
                  // Nessuna compagnia scelta → mostra tutte le entità utilizzabili
                  return tipo === "agenzia" || tipo === "direzione" || tipo === "broker" || tipo === "plurimandataria";
                })
                .map((c: any) => {
                  const tipo = (c.tipo || "").toLowerCase();
                  const tipoLabel = tipo ? tipo.charAt(0).toUpperCase() + tipo.slice(1) : "";
                  return {
                    value: c.id,
                    label: `${c.codice || ""} - ${c.nome || ""}`,
                    description: tipoLabel,
                    searchText: `${c.tipo || ""} ${c.gruppo_compagnia || ""}`,
                  };
                })}
            />
          </div>

        </div>

        {/* Rapporto Agenzia: visibile solo per broker / plurimandataria */}
        {isBrokerLike && selectedCompagnia && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Rapporto Agenzia <span className="text-destructive">*</span>
              </Label>
              {(rapportiAgenzia || []).length === 0 ? (
                <div className="h-8 px-2 flex items-center text-xs rounded-md border border-destructive/50 bg-destructive/5 text-destructive">
                  Nessun rapporto attivo con questa compagnia
                </div>
              ) : (rapportiAgenzia || []).length === 1 ? (
                <div className="h-8 px-2 flex items-center text-xs rounded-md border bg-muted/30">
                  {(rapportiAgenzia)[0].nome_rapporto || (rapportiAgenzia)[0].codice_rapporto || "—"}
                  {(rapportiAgenzia)[0].tipo_rapporto ? ` · ${(rapportiAgenzia)[0].tipo_rapporto}` : ""}
                </div>
              ) : (
                <SearchableSelect
                  className={`h-8 text-xs ${!selectedRapportoId ? "ring-1 ring-amber-500" : ""}`}
                  value={selectedRapportoId}
                  onValueChange={(v) => setSelectedRapportoId(v)}
                  placeholder="— Seleziona rapporto —"
                  options={(rapportiAgenzia).map((r) => ({
                    value: r.id,
                    label: r.nome_rapporto || r.codice_rapporto || "—",
                    description: [r.tipo_rapporto, r.codice_rapporto].filter(Boolean).join(" · ") || undefined,
                  }))}
                />
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5 md:col-span-2">
            <RamoSottoramoSelect
              layout="stacked"
              gruppoRamoId={selectedGruppoRamoId}
              ramoId={defaultSottoramoId}
              onChange={({ gruppoRamoId, ramoId }) => {
                const gruppoChanged = gruppoRamoId !== selectedGruppoRamoId;
                if (gruppoChanged) {
                  // Cambio Ramo → reset righe garanzia (con conferma se ci sono dati)
                  const hasRows =
                    premiFirmaRows.some((r) => r.netto || r.tasse || r.sottoramoId) ||
                    premiQuietanzaRows.some((r) => r.netto || r.tasse || r.sottoramoId);
                  if (hasRows) {
                    const ok = window.confirm(
                      "Cambiando Ramo le righe di Composizione Premio già inserite verranno cancellate. Continuare?"
                    );
                    if (!ok) return;
                  }
                  setSelectedGruppoRamoId(gruppoRamoId);
                  setDefaultSottoramoId(null);
                  setPremiFirmaRows([emptyGaranziaRow()]);
                  setPremiQuietanzaRows([emptyGaranziaRow()]);
                  setSelectedRamo("");
                  return;
                }
                // Stesso Ramo: cambia solo il Sottoramo di default.
                // Propaghiamo a: righe vuote (no importi) + righe che avevano il vecchio default.
                const prevDefault = defaultSottoramoId;
                setDefaultSottoramoId(ramoId);
                if (ramoId) setSelectedRamo(ramoId);
                const sel: any = (ramiList || []).find((r: any) => r.id === ramoId);
                if (!sel) return;
                const escludi = !!sel.escludi_provvigioni;
                const aliquota = escludi ? 0 : (Number(sel.aliquota_tasse_ramo) || 0);
                const ssnAttivo = !escludi && !!sel.ssn_attivo;
                const aliquotaSsn = ssnAttivo ? (Number(sel.aliquota_ssn) || 10.5) : 0;
                const preset = (base: GaranziaRow): GaranziaRow => ({
                  ...base,
                  sottoramoId: sel.id,
                  codice: sel.codice,
                  descrizione: sel.descrizione,
                  aliquotaTasse: aliquota,
                  aliquotaSsn,
                  ssnAttivo,
                  escludiProvvigioni: escludi,
                  tasse: escludi ? "0" : base.tasse,
                });
                const propagate = (rows: GaranziaRow[]) =>
                  rows.map((r) => {
                    const isEmpty = !r.netto && !r.tasse && !r.sottoramoId;
                    const matchedPrevDefault = !!prevDefault && r.sottoramoId === prevDefault && !r.netto && !r.tasse;
                    return isEmpty || matchedPrevDefault ? preset(r) : r;
                  });
                setPremiFirmaRows((prev) => propagate(prev));
                setPremiQuietanzaRows((prev) => propagate(prev));
              }}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              La Garanzia selezionata qui è il <b>default</b> proposta nelle nuove righe di Composizione Premio. Puoi cambiarla riga per riga.
            </p>
            {isRCA && (
              <p className="text-[11px] text-primary flex items-center gap-1 mt-1">
                <Info className="h-3 w-3" />
                Ramo RCA rilevato: in fondo alla pagina troverai le sezioni Veicolo, Garanzie e Conducente.
              </p>
            )}

          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">N° Polizza <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                value={numeroPolizza}
                onChange={(e) => setNumeroPolizza(e.target.value)}
                placeholder="N° polizza"
                className={`h-8 text-xs ${!numeroPolizza.trim() ? "border-destructive focus-visible:ring-destructive" : ""}`}
              />
              <Search className="absolute right-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
            </div>
            {!numeroPolizza.trim() && (
              <p className="text-[10px] text-destructive mt-0.5">Obbligatorio</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {tipoSoggetto === "ente" && (
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                CIG/Rif. <span className="text-destructive" title="Obbligatorio per Enti">*</span>
              </Label>
              <Input
                value={cigRif}
                onChange={(e) => setCigRif(e.target.value.toUpperCase())}
                maxLength={cigTemporaneo ? 40 : 10}
                placeholder={cigTemporaneo ? "CIG temporaneo" : "10 caratteri alfanumerici"}
                className={`h-8 text-xs font-mono ${((!cigRif.trim()) || (cigRif.trim() && !cigValido)) ? "border-destructive focus-visible:ring-destructive" : ""}`}
                title="Obbligatorio per clienti di tipo Ente"
              />
              <div className="flex items-center gap-2 mt-1">
                <Checkbox
                  id="cig-temp"
                  checked={cigTemporaneo}
                  onCheckedChange={(v) => setCigTemporaneo(!!v)}
                />
                <Label htmlFor="cig-temp" className="text-[10px] cursor-pointer">
                  CIG temporaneo (formato libero)
                </Label>
              </div>
              {!cigRif.trim() ? (
                <p className="text-[10px] text-destructive mt-0.5">Obbligatorio per Enti</p>
              ) : cigRif.trim() && !cigValido ? (
                <p className="text-[10px] text-destructive mt-0.5">CIG: 10 caratteri alfanumerici</p>
              ) : null}
            </div>
          )}

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
      </PolizzaSection>

      {/* PERIODO */}
      <PolizzaSection title="Periodo" icon={Calendar}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Durata Da</Label>
            <Input type="date" value={durataDa} onChange={(e) => setDurataDa(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Durata A</Label>
            <Input type="date" value={durataA} onChange={(e) => { setDurataA(e.target.value); setDurataATouched(true); }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Anni Durata</Label>
            <Input type="number" min="1" value={anniDurata} onChange={(e) => setAnniDurata(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frazionamento</Label>
            <SearchableSelect
              className="h-8 text-xs"
              value={frazionamento}
              onValueChange={(v) => setFrazionamento(v || "Annuale")}
              options={FRAZIONAMENTO_OPTIONS}
              placeholder="—"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Garanzia Da</Label>
            <Input type="date" value={garanziaDa} onChange={(e) => { setGaranziaDa(e.target.value); setGaranziaDaTouched(true); }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Garanzia A</Label>
            <Input type="date" value={garanziaA} onChange={(e) => { setGaranziaA(e.target.value); setGaranziaATouched(true); }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data Competenza</Label>
            <Input type="date" value={dataCompetenza} onChange={(e) => {
              const v = e.target.value;
              setDataCompetenza(v); setDataCompetenzaTouched(true);
              // Ricalcola Limite Mora se non è stato modificato manualmente
              const gg = parseInt(moraGiorni || "0") || 0;
              if (v && gg >= 0 && !limiteMoraTouched) {
                const d = new Date(v); d.setDate(d.getDate() + gg);
                setLimiteMora(d.toISOString().slice(0, 10));
              }
            }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Limite Mora
              <FieldHint>Ultima data utile per il pagamento prima della decadenza della copertura. Si ricalcola automaticamente da Data Competenza + GG Mora.</FieldHint>
            </Label>
            <Input type="date" value={limiteMora} onChange={(e) => {
              const v = e.target.value;
              setLimiteMora(v);
              setLimiteMoraTouched(true);
              // Ricalcola GG Mora dalla differenza con base = data_competenza || garanzia_da
              const base = dataCompetenza || garanziaDa;
              if (v && base) {
                const ms = new Date(v).getTime() - new Date(base).getTime();
                const gg = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
                setMoraGiorni(String(gg));
              }
            }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Tacito Rinnovo
              <FieldHint>Se attivo, la polizza si rinnova automaticamente alla scadenza salvo disdetta nei termini contrattuali.</FieldHint>
            </Label>
            <div className="flex items-center gap-2 h-8">
              <Switch checked={tacitoRinnovo} onCheckedChange={setTacitoRinnovo} />
              <span className="text-xs text-muted-foreground">{tacitoRinnovo ? "Sì" : "No"}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              GG Mora
              <FieldHint>Giorni di tolleranza dopo la scadenza entro cui il pagamento è ancora valido. Default 15. Aggiornandolo ricalcola il Limite Mora.</FieldHint>
            </Label>
            <Input type="number" min="0" value={moraGiorni} onChange={(e) => {
              const v = e.target.value;
              setMoraGiorni(v);
              const base = dataCompetenza || garanziaDa;
              const gg = parseInt(v || "0") || 0;
              if (base) {
                const d = new Date(base); d.setDate(d.getDate() + gg);
                setLimiteMora(d.toISOString().slice(0, 10));
              }
            }} className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Disdetta (mesi)
              <FieldHint>Mesi di preavviso richiesti per la disdetta della polizza prima della scadenza.</FieldHint>
            </Label>
            <Input type="number" value={disdettaMesi} onChange={(e) => setDisdettaMesi(e.target.value)} placeholder="0" className="h-8 text-xs" />
          </div>
        </div>

      </PolizzaSection>

      {/* QUIETANZE — sezione separata, editabile rata per rata */}
      {!regolazioneMode && (
        <PolizzaSection title="Quietanze (rate da pagare)" icon={Receipt}>
          <QuietanzeEditor
            frazionamento={frazionamento}
            anniDurata={parseInt(anniDurata) || 1}
            garanziaDa={garanziaDa}
            garanziaA={garanziaA}
            dataCompetenza={dataCompetenza}
            defaultsFirstRata={{
              premio_netto: premioNetto || "",
              tasse: String(tasseNum || ""),
              ssn: String(ssnFirmaNum || ""),
              addizionali: addizionali || "",
              provvigioni_firma: String(provvFirma || ""),
              provvigioni_quietanza: String(provvQuietanza || ""),
            }}
            onChange={setQuietanzeDrafts}
          />
        </PolizzaSection>
      )}

      {/* REGOLAZIONE */}
      <PolizzaSection title="Regolazione" icon={Shield} defaultOpen={false}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div className="flex items-center gap-2 h-8">
            <Checkbox id="regolazione" checked={regolazione} onCheckedChange={(v) => setRegolazione(v === true)} />
            <Label htmlFor="regolazione" className="font-normal cursor-pointer text-xs flex items-center gap-1">
              Regolazione Sì
              <FieldHint>Attiva se il premio è soggetto a regolazione periodica (es. polizze con conguaglio a consuntivo sui dati dichiarati).</FieldHint>
            </Label>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Periodicità
              <FieldHint>Cadenza con cui la compagnia richiede i dati per la regolazione del premio.</FieldHint>
            </Label>
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
            <Label className="text-xs flex items-center gap-1">
              Tipo Scadenza
              <FieldHint>"A scadenza": la regolazione è dovuta entro una data fissa. "No scadenza": gestione libera.</FieldHint>
            </Label>
            <SearchableSelect className="h-8 text-xs" value={tipoScadenza} onValueChange={setTipoScadenza} placeholder="—"
              options={[
                { value: "no_scadenza", label: "No Scadenza" },
                { value: "a_scadenza", label: "A Scadenza" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              GG Presentazione
              <FieldHint>Giorni a disposizione del cliente per presentare i dati di regolazione dopo la scadenza periodica.</FieldHint>
            </Label>
            <Input type="number" value={giorniPresentazione} onChange={(e) => setGiorniPresentazione(e.target.value)} placeholder="0" className="h-8 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Tipo Lettera Regolazione
              <FieldHint>Modello di comunicazione inviata al cliente per richiedere i dati di regolazione.</FieldHint>
            </Label>
            <SearchableSelect className="h-8 text-xs" value={tipoLetteraRegolazione} onValueChange={setTipoLetteraRegolazione} placeholder="— Tipo lettera —"
              options={[
                { value: "standard", label: "Standard" },
                { value: "personalizzata", label: "Personalizzata" },
                { value: "nessuna", label: "Nessuna" },
              ]}
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs flex items-center gap-1">
              Libro Matricola
              <FieldHint>Indica se la polizza è gestita a libro matricola (es. flotte veicoli, dipendenti) con aggiornamenti periodici del parco assicurato.</FieldHint>
            </Label>
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
      </PolizzaSection>

      {/* IMPORTI */}
      <PolizzaSection title="Importi" icon={DollarSign}>

        {/* Card stile TitoloDetail: Premi per Garanzia — Firma + Quietanza */}
        <div className="space-y-4">
          {(() => {
            // Sorgente preferita: il Produttore selezionato (selectedAE) — già usato per il lookup % Provvigione Ramo.
            // Fallback: selettore Commerciale (legacy). Solo se nessuno dei due è valorizzato → Sede 100%.
            const ae = (aeList || []).find((a: any) => a.id === selectedAE);
            const aeLabel = ae
              ? (ae.ragione_sociale?.trim() || `${ae.cognome || ""} ${ae.nome || ""}`.trim())
              : null;
            const commLegacy = (commercialiList || []).find((c: any) => c.id === selectedCommerciale);
            const commLabel = commLegacy ? `${commLegacy.cognome} ${commLegacy.nome}` : null;
            const produttoreLabel = aeLabel || commLabel;
            const isSede = !produttoreLabel;
            const commonProvvProps = {
              percentualeAgenzia: percentualeProvvigione,
              onPercentualeAgenziaChange: (v: string) => { setPercentualeProvvigione(v); setPercentualeProvvigioneAuto(false); },
              percentualeAgenziaAuto: percentualeProvvigioneAuto,
              produttoreLabel,
              percentualeCommerciale,
              percentualeCommercialeAuto,
              produttoreIsSede: isSede,
              ramoLabel: selectedRamoData?.descrizione || null,
              fonteAuto: provvigioneFonte || null,
              warningAuto: provvigioneWarning || null,
              onResetAuto: () => setPercentualeProvvigioneAuto(true),
            };
            // Auto-sync: la Quietanza rispecchia la Firma in tempo reale.
            // Le righe Quietanza modificate a mano (quietanzaPersonalizzata=true)
            // si scollegano e smettono di seguire la Firma; il pulsante
            // "Sincronizza da Firma" le riallinea tutte.
            const sincronizzata =
              isQuietanzaSincronizzata(premiQuietanzaRows) &&
              premiQuietanzaRows.length === premiFirmaRows.length &&
              addizionaliQuietanza === addizionali;
            const personalizzati = premiQuietanzaRows.map((r) => !!r.quietanzaPersonalizzata);
            return (
              <>
                <PremiGaranziaCardShell
                  tipoPremio="firma"
                  gruppoRamoId={selectedGruppoRamoId}
                  defaultSottoramoId={defaultSottoramoId}

                  rows={premiFirmaRows}
                  onRowsChange={(next) => {
                    setPremiFirmaRows(next);
                    setPremiQuietanzaRows((prev) => syncQuietanzaFromFirma(next, prev));
                  }}
                  addizionali={addizionali}
                  onAddizionaliChange={(v) => {
                    setAddizionali(v);
                    setAddizionaliQuietanza(v);
                  }}
                  provvigioni={provvFirma}
                  {...commonProvvProps}
                  headerExtra={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setPremiQuietanzaRows(mirrorAllFromFirma(premiFirmaRows));
                        setAddizionaliQuietanza(addizionali);
                        toast.success("Quietanza riallineata alla Firma");
                      }}
                      title="Riallinea l'intera Quietanza alla Firma, azzerando le personalizzazioni"
                    >
                      Copia in Quietanza
                    </Button>
                  }
                />
                <PremiGaranziaCardShell
                  tipoPremio="quietanza"
                  gruppoRamoId={selectedGruppoRamoId}
                  defaultSottoramoId={defaultSottoramoId}

                  rows={premiQuietanzaRows}
                  onRowsChange={(next) => {
                    setPremiQuietanzaRows((prev) => markQuietanzaEdits(prev, next));
                  }}
                  addizionali={addizionaliQuietanza}
                  onAddizionaliChange={setAddizionaliQuietanza}
                  provvigioni={provvQuietanza}
                  {...commonProvvProps}
                  sincronizzata={sincronizzata}
                  personalizzati={personalizzati}
                  onResetRow={(idx) =>
                    setPremiQuietanzaRows((prev) => resetQuietanzaRow(premiFirmaRows, prev, idx))
                  }
                  headerExtra={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={sincronizzata}
                      onClick={() => {
                        setPremiQuietanzaRows(mirrorAllFromFirma(premiFirmaRows));
                        setAddizionaliQuietanza(addizionali);
                      }}
                      title="Riallinea tutte le voci alla Firma, azzerando le personalizzazioni"
                    >
                      Sincronizza da Firma
                    </Button>
                  }
                />
              </>
            );

          })()}
        </div>

        {/* Flags row */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
          {[
            { id: "rimborso", label: "Rimborso", checked: rimborso, onChange: setRimborso },
            { id: "indicizzata", label: "Indicizzata", checked: indicizzata, onChange: setIndicizzata },
            { id: "noCalcoloTasse", label: "No Calcolo Tasse", checked: noCalcoloTasse, onChange: setNoCalcoloTasse },
            { id: "pagDiretto", label: "Pag. Diretto Agenzia", checked: pagDirettoCompagnia, onChange: setPagDirettoCompagnia },
            { id: "emissioneFee", label: "Emissione Fee", checked: emissioneFee, onChange: setEmissioneFee },
            { id: "formatoElett", label: "Formato Elettronico", checked: formatoElettronico, onChange: setFormatoElettronico },
          ].map((flag) => (
            <div key={flag.id} className="flex items-center gap-1.5">
              <Checkbox id={flag.id} checked={flag.checked} onCheckedChange={(v) => flag.onChange(v === true)} />
              <Label htmlFor={flag.id} className="font-normal cursor-pointer text-xs">{flag.label}</Label>
            </div>
          ))}
        </div>

        {/* Solo valuta — i dati di incasso/copertura vengono valorizzati nel flusso "Messa a Cassa" su TitoloDetail */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Valuta</Label>
            <SearchableSelect className="h-8 text-xs" value={valuta} onValueChange={setValuta} placeholder="—"
              options={[{ value: "EUR", label: "EUR" }, { value: "USD", label: "USD" }, { value: "GBP", label: "GBP" }]}
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground italic pt-1">
          ℹ️ Fax/Copertura/Data Incasso vengono compilati nella <b>Messa a Cassa</b> dopo la creazione del titolo.
        </p>
      </PolizzaSection>

      {/* PROVVIGIONI — solo selezione Commerciale (% Agenzia, totale e ripartizione sono nelle card Firma/Quietanza) */}
      <PolizzaSection title="Provvigioni — Commerciale" icon={Percent}>
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
            <Label className="text-xs flex items-center gap-1.5">
              % Produttore
              <FieldHint>Quota provvigionale del Produttore selezionato. Default popolato dalla matrice "Provvigioni per Ramo".</FieldHint>
              {percentualeCommercialeAuto && (
                <span className="inline-flex items-center rounded-sm bg-primary/15 text-primary px-1.5 py-0.5 text-[9px] font-bold uppercase">auto</span>
              )}
            </Label>
            <Input
              type="number" step="1" min="0" max="100"
              value={percentualeCommerciale}
              onChange={(e) => { setPercentualeCommerciale(e.target.value); setPercentualeCommercialeAuto(false); }}
              disabled={selectedCommerciale === "__sede__"}
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              % AE
              <FieldHint>Quota provvigione spettante all'Account Executive. Sommata alla % Produttore, il residuo va a Consulbrokers SPA. Somma totale ≤ 100%.</FieldHint>
              {!selectedAccountExecutiveId && (
                <span className="text-[9px] text-muted-foreground">(seleziona AE)</span>
              )}
            </Label>
            <Input
              type="number" step="0.01" min="0" max="100"
              value={percentualeAE}
              onChange={(e) => setPercentualeAE(e.target.value)}
              disabled={!selectedAccountExecutiveId}
              placeholder="0,00"
              className="h-8 text-xs font-mono"
            />
            {(() => {
              const sum = (parseFloat(percentualeCommerciale) || 0) + (parseFloat(percentualeAE) || 0);
              if (sum > 100.001) {
                return <p className="text-[10px] text-red-600 mt-0.5">Somma {sum.toFixed(2)}% &gt; 100%</p>;
              }
              if (selectedAccountExecutiveId && (parseFloat(percentualeAE) || 0) > 0) {
                return <p className="text-[10px] text-muted-foreground mt-0.5">Consul residuo: {(100 - sum).toFixed(2)}%</p>;
              }
              return null;
            })()}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5">
              % Brokeraggio
              <FieldHint>Quota di brokeraggio del Produttore. Default popolato da "% Provv. Consulenza" dell'anagrafica professionale.</FieldHint>
              {percentualeBrokeraggioAuto && (
                <span className="inline-flex items-center rounded-sm bg-primary/15 text-primary px-1.5 py-0.5 text-[9px] font-bold uppercase">auto</span>
              )}
            </Label>
            <Input
              type="number" step="0.01" min="0" max="100"
              value={percentualeBrokeraggio}
              onChange={(e) => { setPercentualeBrokeraggio(e.target.value); setPercentualeBrokeraggioAuto(false); }}
              placeholder="0,00"
              className="h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Brokeraggio Firma €</Label>
            <Input
              type="text" readOnly tabIndex={-1}
              value={brokFirma ? brokFirma.toFixed(2) : "—"}
              className="h-8 text-xs font-mono bg-muted/40"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Brokeraggio Quietanza €</Label>
            <Input
              type="text" readOnly tabIndex={-1}
              value={brokQuietanza ? brokQuietanza.toFixed(2) : "—"}
              className="h-8 text-xs font-mono bg-muted/40"
            />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground italic mt-2">
          ℹ️ % e importo provvigione sono modificabili direttamente nelle card <b>Firma</b> e <b>Quietanza</b>.
          {percentualeCommercialeAuto && <> La % Commerciale è auto-popolata da <b>Provvigioni per Ramo</b> del produttore.</>}
        </p>
      </PolizzaSection>


      {/* === SEZIONI RCA AUTO === */}
      {isRCA && (() => {
        // Helper: classe campo per evidenziare i valori riempiti dall'AI
        const aiCls = (key: string) =>
          aiPrefilled.has(key) ? "border-l-2 border-l-primary bg-primary/[0.03]" : "";
        const aiBadge = (key: string) =>
          aiPrefilled.has(key) ? (
            <Sparkles className="inline-block h-3 w-3 text-primary ml-1" />
          ) : null;
        // Sincronizzazione KW ↔ CV (1 KW ≈ 1.36 CV fiscali)
        const handleCvChange = (val: string) => {
          setVCv(val); clearAiPrefilled("vCv"); setKwCvLocked("cv");
          if (kwCvLocked !== "kw") {
            const n = parseFloat(val);
            if (!isNaN(n) && n > 0) { setVKw(String(Math.round(n / 1.36))); clearAiPrefilled("vKw"); }
          }
        };
        const handleKwChange = (val: string) => {
          setVKw(val); clearAiPrefilled("vKw"); setKwCvLocked("kw");
          if (kwCvLocked !== "cv") {
            const n = parseFloat(val);
            if (!isNaN(n) && n > 0) { setVCv(String(Math.round(n * 1.36))); clearAiPrefilled("vCv"); }
          }
        };
        // Auto somma pesi
        const handlePesoChange = (which: "m" | "r", val: string) => {
          if (which === "m") { setVPesoMotrice(val); clearAiPrefilled("vPesoMotrice"); }
          else { setVPesoRimorchio(val); clearAiPrefilled("vPesoRimorchio"); }
          const m = parseFloat(which === "m" ? val : vPesoMotrice) || 0;
          const r = parseFloat(which === "r" ? val : vPesoRimorchio) || 0;
          if (m && r) { setVPesoTotale(String(m + r)); clearAiPrefilled("vPesoTotale"); }
        };
        // Validazione targa
        const targaValid = !vTarga || isTargaItValid(vTarga);
        const telaioValid = !vTelaio || vTelaio.replace(/\s/g, "").length === 17;
        // Toggle Conducente = Contraente
        const applyConducenteFromContraente = (checked: boolean) => {
          setConducenteUgualeContraente(checked);
          if (!checked || !clienteDettaglio) return;
          const c: any = clienteDettaglio;
          setCNome(c.nome || ""); clearAiPrefilled("cNome");
          setCCognome(c.cognome || ""); clearAiPrefilled("cCognome");
          const isPrivato = (c.tipo_cliente || "") === "privato";
          const ind = isPrivato ? c.indirizzo_residenza : (c.indirizzo_sede || c.indirizzo_residenza);
          const cap = isPrivato ? c.cap_residenza : (c.cap_sede || c.cap_residenza);
          const citta = isPrivato ? c.citta_residenza : (c.citta_sede || c.citta_residenza);
          const prov = isPrivato ? c.provincia_residenza : (c.provincia_sede || c.provincia_residenza);
          if (ind) { setCIndirizzo(ind); clearAiPrefilled("cIndirizzo"); }
          if (cap) { setCCap(cap); clearAiPrefilled("cCap"); }
          if (citta) { setCCitta(citta); clearAiPrefilled("cCitta"); }
          if (prov) { setCProvincia(String(prov).toUpperCase()); clearAiPrefilled("cProvincia"); }
          if (c.data_nascita) { setCDataNascita(c.data_nascita); clearAiPrefilled("cDataNascita"); }
          // Se data nascita assente, prova a derivarla dal CF
          if (!c.data_nascita && c.codice_fiscale) {
            const parsed = parseCF(c.codice_fiscale);
            if (parsed) {
              setCDataNascita(parsed.dataNascita);
              const comune = lookupComune(parsed.codiceCatastale);
              if (comune && !prov) setCProvincia(comune.provincia);
            }
          }
          // Default patente per tipo veicolo
          if (!cTipoPatente) setCTipoPatente(defaultPatenteForVeicolo(vTipoVeicolo));
        };
        // Indirizzo conducente da Google Maps
        const handleAddressSelect = (parts: { indirizzo: string; cap: string; citta: string; provincia: string }) => {
          if (parts.cap) { setCCap(parts.cap); clearAiPrefilled("cCap"); }
          if (parts.citta) { setCCitta(parts.citta); clearAiPrefilled("cCitta"); }
          if (parts.provincia) {
            setCProvincia(parts.provincia.toUpperCase());
            clearAiPrefilled("cProvincia");
            // Pre-popola provincia di circolazione se vuota
            if (!vProvinciaCircolazione) {
              setVProvinciaCircolazione(parts.provincia.toUpperCase());
              clearAiPrefilled("vProvinciaCircolazione");
            }
          }
        };
        const provinciaCircDiverge =
          vProvinciaCircolazione && cProvincia && vProvinciaCircolazione !== cProvincia;

        return (
        <>
          {/* Banner intro RCA */}
          <div className="rounded-lg border border-primary/30 bg-primary/[0.06] px-4 py-2.5 flex items-center gap-3 mt-2">
            <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-primary uppercase tracking-wide">Sezione RCA Auto</p>
              <p className="text-xs text-muted-foreground">Compila i dati di veicolo e conducente — i campi con <Sparkles className="inline h-3 w-3 text-primary" /> sono stati riempiti dall'AI.</p>
            </div>
          </div>

          {/* DATI VEICOLO */}
          <PolizzaSection title="Dati Veicolo" icon={Car}>
            {/* Sub: Identificazione */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Identificazione</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">
                    Tipo Veicolo{isRCA && <span className="text-destructive ml-0.5">*</span>}{aiBadge("vTipoVeicolo")}
                  </Label>
                  <SearchableSelect className={`h-9 text-sm ${aiCls("vTipoVeicolo")} ${isRCA && !vTipoVeicolo ? "border-amber-500" : ""}`} value={vTipoVeicolo}
                    onValueChange={(v) => { setVTipoVeicolo(v); setVSettore(v); clearAiPrefilled("vTipoVeicolo"); }}
                    placeholder="—" options={TIPI_VEICOLO} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Marca{aiBadge("vMarca")}</Label>
                  <MarcaCombobox className={`h-9 text-sm ${aiCls("vMarca")}`} value={vMarca}
                    onValueChange={(v) => { setVMarca(v); setVModello(""); clearAiPrefilled("vMarca"); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Modello{aiBadge("vModello")}</Label>
                  <ModelloCombobox className={`h-9 text-sm ${aiCls("vModello")}`} marca={vMarca} value={vModello}
                    onValueChange={(v) => { setVModello(v); clearAiPrefilled("vModello"); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Versione{aiBadge("vVersione")}</Label>
                  <Input value={vVersione} onChange={(e) => { setVVersione(e.target.value); clearAiPrefilled("vVersione"); }}
                    className={`h-9 text-sm ${aiCls("vVersione")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">
                    Targa{isRCA && <span className="text-destructive ml-0.5">*</span>}{aiBadge("vTarga")}
                    {vTarga && !targaValid && <span className="ml-1 text-[10px] text-amber-600">⚠ formato</span>}
                  </Label>
                  <Input value={vTarga} onChange={(e) => { setVTarga(e.target.value.toUpperCase()); clearAiPrefilled("vTarga"); }}
                    className={`h-9 text-sm font-mono uppercase ${aiCls("vTarga")} ${(vTarga && !targaValid) || (isRCA && !vTarga) ? "border-amber-500" : ""}`} placeholder="AB123CD" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">
                    Telaio (VIN){aiBadge("vTelaio")}
                    {vTelaio && !telaioValid && <span className="ml-1 text-[10px] text-amber-600">⚠ 17 car.</span>}
                  </Label>
                  <Input value={vTelaio} onChange={(e) => { setVTelaio(e.target.value.toUpperCase()); clearAiPrefilled("vTelaio"); }}
                    className={`h-9 text-sm font-mono uppercase ${aiCls("vTelaio")} ${vTelaio && !telaioValid ? "border-amber-500" : ""}`} maxLength={17} />
                </div>
                <div className="space-y-1 sm:col-span-2 md:col-span-3 lg:col-span-2">
                  <Label className="text-[11px] font-medium text-foreground/80">Descrizione completa{aiBadge("vDescrizione")}</Label>
                  <Input value={vDescrizione} onChange={(e) => { setVDescrizione(e.target.value); clearAiPrefilled("vDescrizione"); }}
                    placeholder="es. AUDI A1 1.6 TDI SPORTBACK" className={`h-9 text-sm ${aiCls("vDescrizione")}`} />
                </div>
              </div>
            </div>

            {/* Sub: Circolazione */}
            <div className="pt-3 border-t border-border/40">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Circolazione</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">
                    Uso{isRCA && <span className="text-destructive ml-0.5">*</span>}
                  </Label>
                  <SearchableSelect className={`h-9 text-sm ${isRCA && !vUso ? "border-amber-500" : ""}`} value={vUso} onValueChange={setVUso} placeholder="—"
                    options={rcaUsi || []} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">
                    Provincia Circolazione{aiBadge("vProvinciaCircolazione")}
                    {provinciaCircDiverge && <span className="ml-1 text-[10px] text-amber-600" title="Differisce dalla residenza del conducente">⚠</span>}
                  </Label>
                  <SearchableSelect className={`h-9 text-sm ${aiCls("vProvinciaCircolazione")}`} value={vProvinciaCircolazione}
                    onValueChange={(v) => { setVProvinciaCircolazione(v); clearAiPrefilled("vProvinciaCircolazione"); }}
                    placeholder="—" options={PROVINCE_IT} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Classe B/M{aiBadge("vClasseBm")}</Label>
                  <SearchableSelect className={`h-9 text-sm ${aiCls("vClasseBm")}`} value={vClasseBm}
                    onValueChange={(v) => { setVClasseBm(v); clearAiPrefilled("vClasseBm"); }}
                    placeholder="—" options={CLASSI_MERITO} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Immatricolazione{aiBadge("vDataImmatricolazione")}</Label>
                  <Input type="date" value={vDataImmatricolazione}
                    onChange={(e) => { setVDataImmatricolazione(e.target.value); clearAiPrefilled("vDataImmatricolazione"); }}
                    className={`h-9 text-sm ${aiCls("vDataImmatricolazione")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Anno Acquisto{aiBadge("vAnnoAcquisto")}</Label>
                  <Input type="number" value={vAnnoAcquisto}
                    onChange={(e) => { setVAnnoAcquisto(e.target.value); clearAiPrefilled("vAnnoAcquisto"); }}
                    className={`h-9 text-sm font-mono ${aiCls("vAnnoAcquisto")}`} />
                </div>
              </div>
            </div>

            {/* Sub: Caratteristiche tecniche */}
            <div className="pt-3 border-t border-border/40">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Caratteristiche tecniche</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">CV{aiBadge("vCv")}</Label>
                  <Input type="number" value={vCv} onChange={(e) => handleCvChange(e.target.value)}
                    className={`h-9 text-sm font-mono ${aiCls("vCv")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">KW{aiBadge("vKw")}</Label>
                  <Input type="number" value={vKw} onChange={(e) => handleKwChange(e.target.value)}
                    className={`h-9 text-sm font-mono ${aiCls("vKw")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">CC{aiBadge("vCc")}</Label>
                  <Input type="number" value={vCc} onChange={(e) => { setVCc(e.target.value); clearAiPrefilled("vCc"); }}
                    className={`h-9 text-sm font-mono ${aiCls("vCc")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Posti{aiBadge("vPosti")}</Label>
                  <Input type="number" value={vPosti} onChange={(e) => { setVPosti(e.target.value); clearAiPrefilled("vPosti"); }}
                    className={`h-9 text-sm font-mono ${aiCls("vPosti")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Peso Mot.{aiBadge("vPesoMotrice")}</Label>
                  <Input type="number" value={vPesoMotrice} onChange={(e) => handlePesoChange("m", e.target.value)}
                    className={`h-9 text-sm font-mono ${aiCls("vPesoMotrice")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Peso Rim.{aiBadge("vPesoRimorchio")}</Label>
                  <Input type="number" value={vPesoRimorchio} onChange={(e) => handlePesoChange("r", e.target.value)}
                    className={`h-9 text-sm font-mono ${aiCls("vPesoRimorchio")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Peso Tot.{aiBadge("vPesoTotale")}</Label>
                  <Input type="number" value={vPesoTotale} onChange={(e) => { setVPesoTotale(e.target.value); clearAiPrefilled("vPesoTotale"); }}
                    className={`h-9 text-sm font-mono ${aiCls("vPesoTotale")}`} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 mt-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">
                    Tipologia Guida{isRCA && <span className="text-destructive ml-0.5">*</span>}{aiBadge("vTipologiaGuida")}
                  </Label>
                  <SearchableSelect className={`h-9 text-sm ${aiCls("vTipologiaGuida")} ${isRCA && !vTipologiaGuida ? "border-amber-500" : ""}`} value={vTipologiaGuida}
                    onValueChange={(v) => { setVTipologiaGuida(v); clearAiPrefilled("vTipologiaGuida"); }}
                    placeholder="—" options={["Libera","Esperta"].map(v => ({ value: v, label: v }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Alimentazione{aiBadge("vTipoAlimentazione")}</Label>
                  <SearchableSelect className={`h-9 text-sm ${aiCls("vTipoAlimentazione")}`} value={vTipoAlimentazione}
                    onValueChange={(v) => { setVTipoAlimentazione(v); clearAiPrefilled("vTipoAlimentazione"); }}
                    placeholder="—" options={["Benzina","Diesel","GPL","Metano","Ibrido","Elettrico"].map(v => ({ value: v, label: v }))} />
                </div>
              </div>
            </div>

            {/* Sub: Coperture */}
            <div className="pt-3 border-t border-border/40">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Coperture e massimali</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Massimale 1{aiBadge("vMass1")}</Label>
                  <Input type="number" step="0.01" value={vMass1} onChange={(e) => { setVMass1(e.target.value); clearAiPrefilled("vMass1"); }}
                    className={`h-9 text-sm font-mono ${aiCls("vMass1")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Massimale 2{aiBadge("vMass2")}</Label>
                  <Input type="number" step="0.01" value={vMass2} onChange={(e) => { setVMass2(e.target.value); clearAiPrefilled("vMass2"); }}
                    className={`h-9 text-sm font-mono ${aiCls("vMass2")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Massimale 3{aiBadge("vMass3")}</Label>
                  <Input type="number" step="0.01" value={vMass3} onChange={(e) => { setVMass3(e.target.value); clearAiPrefilled("vMass3"); }}
                    className={`h-9 text-sm font-mono ${aiCls("vMass3")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Franchigia{aiBadge("vFranchigia")}</Label>
                  <Input type="number" step="0.01" value={vFranchigia} onChange={(e) => { setVFranchigia(e.target.value); clearAiPrefilled("vFranchigia"); }}
                    className={`h-9 text-sm font-mono ${aiCls("vFranchigia")}`} />
                </div>
              </div>
              <div className="mt-3 rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Clausole</div>
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
                      <Label htmlFor={flag.id} className="font-normal cursor-pointer text-sm">{flag.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PolizzaSection>

          {/* DATI CONDUCENTE */}
          <PolizzaSection title="Dati Conducente" icon={UserCheck}>
            {/* Toggle Conducente = Contraente */}
            {clienteDettaglio && (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3 flex items-center gap-2">
                <Checkbox id="cond-uguale-contraente" checked={conducenteUgualeContraente}
                  onCheckedChange={(v) => applyConducenteFromContraente(v === true)} />
                <Label htmlFor="cond-uguale-contraente" className="text-sm font-medium cursor-pointer">
                  Conducente = Contraente
                </Label>
                <span className="text-xs text-muted-foreground">— copia automaticamente nome, indirizzo, CAP, città, provincia e data di nascita (anche da CF)</span>
              </div>
            )}

            {/* Sub: Anagrafica */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Anagrafica</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Nome{aiBadge("cNome")}</Label>
                  <Input value={cNome} onChange={(e) => { setCNome(e.target.value); clearAiPrefilled("cNome"); }}
                    className={`h-9 text-sm ${aiCls("cNome")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Cognome{aiBadge("cCognome")}</Label>
                  <Input value={cCognome} onChange={(e) => { setCCognome(e.target.value); clearAiPrefilled("cCognome"); }}
                    className={`h-9 text-sm ${aiCls("cCognome")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Data Nascita{aiBadge("cDataNascita")}</Label>
                  <Input type="date" value={cDataNascita}
                    onChange={(e) => { setCDataNascita(e.target.value); clearAiPrefilled("cDataNascita"); }}
                    className={`h-9 text-sm ${aiCls("cDataNascita")}`} />
                </div>
              </div>
            </div>

            {/* Sub: Residenza (Google Maps) */}
            <div className="pt-3 border-t border-border/40">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Residenza</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-medium text-foreground/80">Indirizzo{aiBadge("cIndirizzo")}</Label>
                  <AddressAutocomplete
                    value={cIndirizzo}
                    onChange={(v) => { setCIndirizzo(v); clearAiPrefilled("cIndirizzo"); }}
                    onSelect={handleAddressSelect}
                    placeholder="Digita per cercare l'indirizzo…"
                    className={`h-9 text-sm pr-8 ${aiCls("cIndirizzo")}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">CAP{aiBadge("cCap")}</Label>
                  <Input value={cCap} onChange={(e) => { setCCap(e.target.value); clearAiPrefilled("cCap"); }}
                    className={`h-9 text-sm font-mono ${aiCls("cCap")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Città{aiBadge("cCitta")}</Label>
                  <Input value={cCitta} onChange={(e) => { setCCitta(e.target.value); clearAiPrefilled("cCitta"); }}
                    className={`h-9 text-sm ${aiCls("cCitta")}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Provincia{aiBadge("cProvincia")}</Label>
                  <SearchableSelect className={`h-9 text-sm ${aiCls("cProvincia")}`} value={cProvincia}
                    onValueChange={(v) => { setCProvincia(v); clearAiPrefilled("cProvincia"); }}
                    placeholder="—" options={PROVINCE_IT} />
                </div>
              </div>
            </div>

            {/* Sub: Patente */}
            <div className="pt-3 border-t border-border/40">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Patente</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Tipo Patente{aiBadge("cTipoPatente")}</Label>
                  <SearchableSelect className={`h-9 text-sm ${aiCls("cTipoPatente")}`} value={cTipoPatente}
                    onValueChange={(v) => { setCTipoPatente(v); clearAiPrefilled("cTipoPatente"); }}
                    placeholder={`— (default ${defaultPatenteForVeicolo(vTipoVeicolo)})`} options={TIPI_PATENTE} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-foreground/80">Data Rilascio{aiBadge("cDataRilascioPatente")}</Label>
                  <Input type="date" value={cDataRilascioPatente}
                    onChange={(e) => { setCDataRilascioPatente(e.target.value); clearAiPrefilled("cDataRilascioPatente"); }}
                    className={`h-9 text-sm ${aiCls("cDataRilascioPatente")}`} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-medium text-foreground/80">Note</Label>
                  <Input value={cNote} onChange={(e) => setCNote(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
            </div>
          </PolizzaSection>
        </>
        );
      })()}


      {/* ACTIONS */}
      <div className="flex flex-col gap-2 pt-2">
        {saveBlockReason && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            ⚠ {saveBlockReason}
          </div>
        )}
        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => navigate("/portafoglio/attive")}>Chiudi</Button>
          <Button
            onClick={handleConferma}
            disabled={saving || !!saveBlockReason}
            title={saveBlockReason || undefined}
          >
            {saving ? "Salvataggio..." : "Conferma"}
          </Button>
        </div>
      </div>

      <LibroMatricolaDialog
        open={matricolaDialogOpen}
        onOpenChange={setMatricolaDialogOpen}
        righe={righeMatricola}
        onChange={setRigheMatricola}
      />
    </div>
  );
};

export default ImmissionePolizzaPage;
