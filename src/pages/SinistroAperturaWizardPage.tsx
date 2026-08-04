import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useDraftPersistence, loadDraft, clearDraft } from "@/hooks/useDraftPersistence";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/SearchableSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { FilePlus, Search, ArrowLeft, ArrowRight, Trash2, Upload, FileText, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { formatTipoSinistro } from "@/lib/tipiSinistro";
import { Checkbox } from "@/components/ui/checkbox";
import SinistroPraticaFormFields from "@/components/sinistri/SinistroPraticaFormFields";
import {
  sinistroPraticaSchema,
  sinistroPraticaDefaultValues,
  praticaValuesToDbPayload,
  validateTipoSinistro,
} from "@/lib/sinistroPraticaSchema";
import { applySoloMadriFilter, mergePolizze } from "@/lib/polizzeSearch";
import type { SinistroPrescrizioneDraft, SinistroReminderDraft } from "@/lib/sinistroPrescrizioniReminder";
import {
  DESTINATARIO_LABEL,
  PRESCRIZIONE_DESTINATARIO_AGENZIA,
} from "@/lib/sinistroPrescrizioniReminder";
import { resolveClienteNome } from "@/lib/ecClienteAnagrafica";
import { formatPolizzaRamo, formatPolizzaScadenza } from "@/lib/titoliDisplay";
import { labelAgenziaRiferimento } from "@/lib/compagniaDisplay";
import { formatEdgeFunctionError } from "@/lib/edgeFunctionError";
import {
  documentUploadTooLargeMessage,
  isDocumentUploadTooLarge,
  MAX_DOCUMENT_UPLOAD_MB,
} from "@/lib/uploadLimits";

const DRAFT_KEY = "sinistri:apertura:bozza";

// Tipi sinistro centralizzati in src/lib/tipiSinistro.ts

// Schema di validazione Zod (campi pratica condivisi + step wizard)
const wizardSchema = sinistroPraticaSchema.extend({
  titolo_id: z.string().optional(),
  sinistro_terzi: z.boolean().optional(),
  documenti: z.array(
    z.object({
      nome_file: z.string(),
      path_temp: z.string(),
      categoria: z.string().min(1, "La categoria è obbligatoria"),
      descrizione: z.string().optional(),
      file_base64: z.string().optional(),
    })
  ).optional(),
});

type WizardFormValues = z.infer<typeof wizardSchema>;

export default function SinistroAperturaWizardPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Polizza selezionata (visualizzazione)
  const [selectedPolizzaData, setSelectedPolizzaData] = useState<any>(null);
  const [preselectedCliente, setPreselectedCliente] = useState<any>(null);

  // Stato ricerca polizze (Step 1)
  const [polizzaSearchText, setPolizzaSearchText] = useState("");
  const [polizzeList, setPolizzeList] = useState<any[]>([]);
  const [polizzeLoading, setPolizzeLoading] = useState(false);
  const [soloMadri, setSoloMadri] = useState(true);

  // Stato ricerca cliente (Step 1)
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [selectedClienteData, setSelectedClienteData] = useState<any>(null);
  const [clientiSearchText, setClientiSearchText] = useState("");
  const [clientiList, setClientiList] = useState<any[]>([]);
  const [clientiLoading, setClientiLoading] = useState(false);

  // Bozze prescrizioni/reminder opzionali (Step 4)
  const [prescrizioniDrafts, setPrescrizioniDrafts] = useState<SinistroPrescrizioneDraft[]>([]);
  const [reminderDrafts, setReminderDrafts] = useState<SinistroReminderDraft[]>([]);
  const [prescDraftForm, setPrescDraftForm] = useState<SinistroPrescrizioneDraft>({
    destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
    oggetto: "",
    data_scadenza_risposta: "",
  });
  const [reminderDraftForm, setReminderDraftForm] = useState<SinistroReminderDraft>({ testo: "", data_scadenza: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** File originali in memoria (submit affidabile anche se la bozza omette base64). */
  const pendingFilesRef = useRef<Map<string, File>>(new Map());
  const [dragOver, setDragOver] = useState(false);

  // Inizializzazione React Hook Form
  const { register, control, handleSubmit, setValue, getValues, watch, trigger, formState: { errors } } = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      ...sinistroPraticaDefaultValues,
      titolo_id: "",
      sinistro_terzi: false,
      documenti: [],
    }
  });

  // URL param for cliente preselection
  const [searchParams] = useSearchParams();
  const preselectedClienteId = searchParams.get('cliente_id');

  // Carica polizze (titoli + CGA) per un cliente
  const loadPolizzeForCliente = async (clienteId: string, opts?: { soloMadri?: boolean }) => {
    const onlyMothers = opts?.soloMadri ?? soloMadri;
    setPolizzeLoading(true);
    try {
      const baseTitQuery = supabase.from('titoli')
        .select(`id, numero_titolo, premio_lordo, stato, created_at, cliente_anagrafica_id, ufficio_id, compagnia_id, sostituisce_polizza, data_competenza, data_scadenza, garanzia_a,
          compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome),
          prodotti(nome_prodotto, compagnie(id, nome)),
          ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(id, codice, descrizione)),
          clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente)`)
        .eq('cliente_anagrafica_id', clienteId)
        .order('created_at', { ascending: false })
        .limit(200);
      const titQuery = applySoloMadriFilter(baseTitQuery as any, onlyMothers);

      const [titRes, cgaRes] = await Promise.all([
        titQuery,
        supabase.from('polizza_cga')
          .select(`id, numero_polizza, data_decorrenza, premio_lordo_totale, cliente_id, prodotti_cga(nome_prodotto, compagnia, ramo)`)
          .eq('stato', 'approvato')
          .eq('cliente_id', clienteId)
          .limit(200),
      ]);
      // Nessuna deduplica: mostriamo tutte le occorrenze (polizze madri + quietanze se "Tutte")
      const merged = mergePolizze((titRes.data ?? []) as any, (cgaRes.data ?? []) as any);
      setPolizzeList(merged);
    } finally {
      setPolizzeLoading(false);
    }
  };

  useEffect(() => {
    if (preselectedClienteId) {
      supabase.from('clienti')
        .select('id, cognome, nome, ragione_sociale, tipo_cliente, codice_fiscale, partita_iva')
        .eq('id', preselectedClienteId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setPreselectedCliente(data);
            setSelectedClienteId(data.id);
            setSelectedClienteData(data);
          }
        });
      loadPolizzeForCliente(preselectedClienteId);
    }
  }, [preselectedClienteId]);

  // Ricerca clienti (debounced) — Step 1
  useEffect(() => {
    const raw = clientiSearchText.trim();
    if (!raw) { setClientiList([]); setClientiLoading(false); return; }
    // sanifica: rimuovi caratteri che romperebbero la sintassi .or() di PostgREST
    const q = raw.replace(/[,()]/g, ' ').trim();
    if (!q) { setClientiList([]); setClientiLoading(false); return; }
    setClientiLoading(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('clienti')
        .select('id, nome, cognome, ragione_sociale, tipo_cliente, codice_fiscale, partita_iva')
        .or(`cognome.ilike.%${q}%,nome.ilike.%${q}%,ragione_sociale.ilike.%${q}%,codice_fiscale.ilike.%${q}%,partita_iva.ilike.%${q}%`)
        .order('cognome', { ascending: true, nullsFirst: false })
        .limit(25);
      if (error) console.error('Ricerca clienti error:', error);
      setClientiList(data || []);
      setClientiLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [clientiSearchText]);



  const selezionaCliente = (c: any) => {
    setSelectedClienteId(c.id);
    setSelectedClienteData(c);
    setSelectedPolizzaData(null);
    setValue('titolo_id', '');
    setPolizzaSearchText('');
    loadPolizzeForCliente(c.id);
  };

  const resetCliente = () => {
    setSelectedClienteId(null);
    setSelectedClienteData(null);
    setSelectedPolizzaData(null);
    setValue('titolo_id', '');
    setPolizzeList([]);
    setPolizzaSearchText('');
    setClientiSearchText('');
  };


  const { fields: docFields, append: appendDoc, remove: removeDoc } = useFieldArray({
    control,
    name: "documenti"
  });

  // Watch dei valori critici
  const watchTitoloId = watch("titolo_id");
  const watchSinistroTerzi = watch("sinistro_terzi");
  const watchDocumenti = watch("documenti");
  const watchValues = watch();

  const setSinistroTerzi = (attivo: boolean) => {
    setValue("sinistro_terzi", attivo);
    if (attivo) {
      setSelectedPolizzaData(null);
      setValue("titolo_id", "");
      setPolizzaSearchText("");
    }
  };

  const draftSnapshot = useMemo(
    () => ({
      ...watchValues,
      documenti: (watchValues.documenti ?? []).map(({ file_base64: _b, path_temp: _p, ...rest }) => rest),
    }),
    [watchValues],
  );

  // 1. Carica bozza se esistente
  useEffect(() => {
    const draft = loadDraft<WizardFormValues>(DRAFT_KEY);
    if (draft?.data) {
      const d = draft.data;
      Object.keys(d).forEach((key) => {
        setValue(key as keyof WizardFormValues, d[key]);
      });
      // Se c'è una polizza già selezionata nella bozza (e non è Sinistro Terzi), carichiamo le sue info
      if (d.sinistro_terzi) {
        setValue("titolo_id", "");
      } else if (d.titolo_id) {
        supabase.from("titoli").select(`
          id, numero_titolo, premio_lordo, stato, created_at, cliente_anagrafica_id, ufficio_id, compagnia_id, data_scadenza, garanzia_a,
          compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome),
          prodotti(nome_prodotto, compagnie(id, nome)),
          ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(id, codice, descrizione)),
          clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente)
        `).eq("id", d.titolo_id).maybeSingle().then(({ data }) => {
          if (data) setSelectedPolizzaData(data);
        });
      }
      toast.success("Bozza caricata localmente");
    }
    setDraftLoaded(true);
  }, [setValue]);

  // 2. Abilita salvataggio automatico bozza
  useDraftPersistence(DRAFT_KEY, draftSnapshot, { enabled: draftLoaded });

  // Query per lookup tipo documento (Step 3)
  const { data: lookupTipiDoc = [] } = useQuery({
    queryKey: ["lookup-tipo-documento-wizard"],
    queryFn: async () => {
      const { data } = await supabase.from("lookup_tipo_documento").select("id, codice, descrizione").eq("attivo", true).order("descrizione");
      return data || [];
    }
  });

  // Query per lookup responsabili interni: Specialist Sinistri se configurati, altrimenti tutti i profili attivi
  const { data: responsabiliList = [] } = useQuery({
    queryKey: ["profiles-responsabili-wizard"],
    queryFn: async () => {
      const { data: ss } = await supabase
        .from("specialist_sinistri_sedi" as any)
        .select("profilo_id");
      const ids = [...new Set(((ss || []) as { profilo_id: string }[]).map((r) => r.profilo_id))];
      let q = supabase.from("profiles").select("id, nome, cognome, ruolo").eq("attivo", true).order("cognome");
      if (ids.length > 0) q = q.in("id", ids);
      const { data } = await q;
      return data || [];
    }
  });

  // Query per liquidatori da anagrafiche_professionali (Step 4)
  const { data: liquidatoriList = [] } = useQuery({
    queryKey: ["anagrafiche-liquidatori-wizard"],
    queryFn: async () => {
      const { data } = await supabase.from("anagrafiche_professionali").select("id, nome, cognome, ragione_sociale").eq("tipo", "liquidatore").eq("attivo", true).order("cognome");
      return data || [];
    }
  });

  // (ricerca polizze globale rimossa: ora le polizze derivano dal cliente selezionato)



  // Gestione caricamento file (Step 3)
  const processUploadedFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    let queued = 0;
    let completed = 0;

    list.forEach((file) => {
      if (isDocumentUploadTooLarge(file.size)) {
        toast.error(`${file.name}: ${documentUploadTooLargeMessage()}`);
        return;
      }

      queued += 1;
      const pathTemp = URL.createObjectURL(file);
      pendingFilesRef.current.set(pathTemp, file);

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Content = event.target?.result as string;
        appendDoc({
          nome_file: file.name,
          path_temp: pathTemp,
          categoria: "",
          descrizione: "",
          file_base64: base64Content,
        });
        completed += 1;
        if (completed === queued) {
          toast.success(queued === 1 ? `File "${file.name}" aggiunto` : `${queued} file aggiunti`);
        }
      };
      reader.onerror = () => {
        URL.revokeObjectURL(pathTemp);
        pendingFilesRef.current.delete(pathTemp);
        toast.error(`Impossibile leggere il file "${file.name}"`);
        completed += 1;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      processUploadedFiles(e.target.files);
    }
    e.target.value = "";
  };

  const handleRemoveDocumento = (idx: number) => {
    const pathTemp = getValues(`documenti.${idx}.path_temp`);
    if (pathTemp) {
      URL.revokeObjectURL(pathTemp);
      pendingFilesRef.current.delete(pathTemp);
    }
    removeDoc(idx);
  };

  const base64ToBlob = (base64Content: string, fallbackName: string) => {
    const mimeMatch = base64Content.match(/^data:([^;]+);/);
    const mimeType = mimeMatch?.[1] || "application/octet-stream";
    const base64Data = base64Content.split(",")[1];
    if (!base64Data) throw new Error(`Contenuto non valido per ${fallbackName}`);
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  };

  // Commit eventuale digitazione DateInput ancora in focus prima della validazione step
  const commitFocusedField = async () => {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) {
      el.blur();
      // Attendi handler blur (DateInput → RHF) prima di trigger
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
  };

  // Funzione per validare ed avanzare negli step
  const handleNextStep = async () => {
    await commitFocusedField();

    let fieldsToValidate: any[] = [];
    if (currentStep === 1) {
      if (!selectedClienteId) {
        toast.error("Seleziona un cliente per proseguire");
        return;
      }
      fieldsToValidate = ["data_evento"];
    } else if (currentStep === 2) {
      fieldsToValidate = ["data_denuncia", "descrizione", "importo_riserva"];
      const tipoErr = validateTipoSinistro(getValues("tipo_sinistro"), getValues("tipo_sinistro_personalizzato"));
      if (tipoErr) {
        toast.error(tipoErr);
        return;
      }
    } else if (currentStep === 3) {
      // Step facoltativo: nessun blocco sui documenti in bozza
      fieldsToValidate = [];
    }


    const isValid = await trigger(fieldsToValidate);
    if (isValid) {
      setCurrentStep((prev) => (prev + 1) as any);
    } else {
      toast.error("Controlla i campi obbligatori o con errori");
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => (prev - 1) as any);
  };

  // Reset del wizard e cancellazione bozza
  const handleAnnulla = () => {
    clearDraft(DRAFT_KEY);
    toast.info("Apertura sinistro annullata e bozza cancellata");
    navigate("/sinistri");
  };

  // Salvataggio finale del sinistro (Step 5)
  const onSubmitForm = async (values: WizardFormValues) => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      // Recuperiamo la polizza e il cliente associato
      const isTerzi = !!values.sinistro_terzi;
      const compagniaId = isTerzi
        ? null
        : (selectedPolizzaData?.compagnia_id ||
          selectedPolizzaData?.prodotti?.compagnie?.id ||
          null);
      const clienteAnagraficaId = selectedClienteId || selectedPolizzaData?.cliente_anagrafica_id || null;
      const ufficioId = isTerzi ? null : (selectedPolizzaData?.ufficio_id || null);

      if (!clienteAnagraficaId) {
        throw new Error("Cliente non selezionato");
      }

      const docsConCategoriaMancante = (values.documenti ?? []).filter((d) => !d.categoria?.trim());
      if (docsConCategoriaMancante.length > 0) {
        toast.error("Seleziona il tipo documento per ogni file caricato prima di confermare");
        setCurrentStep(3);
        setSubmitting(false);
        return;
      }

      // 1. Creazione del sinistro tramite edge function unificata
      //    (checklist di default + log_attivita + evento timeline generati lato server)
      const praticaPayload = praticaValuesToDbPayload(values);
      const titoloId =
        !isTerzi && values.titolo_id && !values.titolo_id.startsWith("cga:")
          ? values.titolo_id
          : null;

      const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke("gestione-sinistri", {
        body: {
          azione: "crea",
          sinistro_terzi: isTerzi,
          titolo_id: titoloId,
          cliente_anagrafica_id: clienteAnagraficaId,
          ...(compagniaId ? { compagnia_id: compagniaId } : {}),
          ...(ufficioId ? { ufficio_id: ufficioId } : {}),
          ...praticaPayload,
          user_id: user.id,
          stato_iniziale: "aperto",
          ...(prescrizioniDrafts.length > 0 ? { prescrizioni_iniziali: prescrizioniDrafts } : {}),
          ...(reminderDrafts.length > 0 ? { reminder_iniziali: reminderDrafts } : {}),
        },
      });
      if (invokeErr || !invokeRes?.success) {
        throw new Error(formatEdgeFunctionError(invokeErr, invokeRes));
      }
      const newSinistro = invokeRes.sinistro as { id: string; numero_sinistro: string };


      // 3. Upload documenti se presenti
      if (values.documenti && values.documenti.length > 0) {
        for (const doc of values.documenti) {
          const pendingFile = doc.path_temp ? pendingFilesRef.current.get(doc.path_temp) : undefined;
          const blob = pendingFile ?? (doc.file_base64 ? base64ToBlob(doc.file_base64, doc.nome_file) : null);
          if (!blob) {
            toast.error(`File "${doc.nome_file}" non disponibile: ricaricalo nello step Documenti`);
            continue;
          }

          const storagePath = `sinistro/${newSinistro.id}/${Date.now()}_${doc.nome_file}`;

          // Upload su Supabase Storage bucket documenti_sinistri
          const { error: uploadErr } = await supabase.storage
            .from("documenti_sinistri")
            .upload(storagePath, blob, {
              contentType: pendingFile?.type || blob.type || "application/octet-stream",
            });

          if (uploadErr) throw uploadErr;

          // Inserimento metadati del documento nel DB
          const { error: docDbErr } = await supabase.from("documenti").insert({
            nome_file: doc.nome_file,
            path_storage: storagePath,
            bucket_name: "documenti_sinistri",
            entita_tipo: "sinistro",
            entita_id: newSinistro.id,
            caricato_da: user.id,
            categoria: doc.categoria,
            descrizione: doc.descrizione || null,
          });

          if (docDbErr) throw docDbErr;

          if (doc.path_temp) {
            URL.revokeObjectURL(doc.path_temp);
            pendingFilesRef.current.delete(doc.path_temp);
          }
        }
      }

      // 4. Rimozione bozza da localStorage
      clearDraft(DRAFT_KEY);

      toast.success(`Sinistro ${newSinistro.numero_sinistro} aperto con successo!`);
      navigate(`/sinistri/${newSinistro.id}`);
    } catch (err: any) {
      toast.error("Errore durante l'apertura del sinistro: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header coerente con design system (icona arancio rotonda) */}
      <div className="flex items-center justify-between pb-4 border-b gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {watchSinistroTerzi ? "Apertura Sinistro Terzi" : "Apertura Nuovo Sinistro"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {watchSinistroTerzi
                ? "Procedura guidata per sinistro senza polizza CBnet"
                : "Procedura guidata per l'apertura di un sinistro su polizza attiva"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCancelDialogOpen(true)} className="text-destructive border-destructive hover:bg-destructive/10">
          Annulla apertura
        </Button>
      </div>


      {/* Barra di Progresso */}
      <div className="relative">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted -translate-y-1/2" />
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 transition-all duration-300"
          style={{ width: `${((currentStep - 1) / 4) * 100}%` }}
        />
        <div className="relative flex justify-between">
          {[1, 2, 3, 4, 5].map((stepIndex) => (
            <div key={stepIndex} className="flex flex-col items-center">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs border-2 z-10 transition-all ${
                  currentStep === stepIndex 
                    ? "bg-primary border-primary text-primary-foreground shadow-md ring-4 ring-primary/20" 
                    : currentStep > stepIndex 
                      ? "bg-primary border-primary text-primary-foreground" 
                      : "bg-background border-muted text-muted-foreground"
                }`}
              >
                {stepIndex}
              </div>
              <span className={`text-[10px] font-medium mt-2 hidden sm:block ${currentStep === stepIndex ? "text-primary font-bold" : "text-muted-foreground"}`}>
                {stepIndex === 1 && (watchSinistroTerzi ? "Cliente" : "Polizza")}
                {stepIndex === 2 && "Dati Sinistro"}
                {stepIndex === 3 && "Documenti"}
                {stepIndex === 4 && "Assegnazione"}
                {stepIndex === 5 && "Riepilogo"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Corpo del Form */}
      <form onSubmit={handleSubmit(onSubmitForm)}>
        <Card className="shadow-md border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {currentStep === 1 && (watchSinistroTerzi ? "Step 1: Cliente (Sinistro Terzi)" : "Step 1: Cliente e Polizza")}
              {currentStep === 2 && "Step 2: Dettagli dell'Accadimento"}
              {currentStep === 3 && "Step 3: Documenti Iniziali"}
              {currentStep === 4 && "Step 4: Assegnazione Pratica"}
              {currentStep === 5 && "Step 5: Riepilogo e Conferma"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && (watchSinistroTerzi
                ? "Seleziona il cliente. Nessuna polizza CBnet verrà collegata a questa pratica."
                : "Seleziona prima il cliente, poi scegli una delle sue polizze attive. La polizza è facoltativa.")}
              {currentStep === 2 && "Fornisci tutte le informazioni relative a quando, dove e come si è verificato il sinistro."}
              {currentStep === 3 && "Carica referti, foto o denunce firmate. Questo step è facoltativo."}
              {currentStep === 4 && "Assegna la pratica a un addetto interno e ad un liquidatore di riferimento."}
              {currentStep === 5 && "Verifica la correttezza di tutti i dati prima dell'apertura formale della pratica."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* STEP 1: CLIENTE + POLIZZA */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* 1) Ricerca cliente */}
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  {selectedClienteData ? (
                    <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded-lg border">
                      <div className="text-sm">
                        <p className="font-semibold">{resolveClienteNome(selectedClienteData)}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedClienteData.codice_fiscale || selectedClienteData.partita_iva || "—"}
                          {selectedClienteData.tipo_cliente ? ` · ${selectedClienteData.tipo_cliente}` : ""}
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={resetCliente}>
                        Cambia cliente
                      </Button>
                    </div>
                  ) : (
                    <SearchableSelect
                      options={clientiList.map((c: any) => ({
                        value: c.id,
                        label: resolveClienteNome(c) || "(senza nome)",
                        description: [c.codice_fiscale || c.partita_iva, c.tipo_cliente].filter(Boolean).join(" · "),
                        searchText: `${resolveClienteNome(c)} ${c.codice_fiscale || ""} ${c.partita_iva || ""}`,
                      }))}
                      value=""
                      onValueChange={(val) => {
                        const c = clientiList.find((x: any) => x.id === val);
                        if (c) selezionaCliente(c);
                      }}
                      placeholder="Cerca cliente per nome, cognome, ragione sociale, CF o P.IVA..."
                      searchPlaceholder="Digita almeno 2 caratteri…"
                      searchValue={clientiSearchText}
                      onSearchChange={setClientiSearchText}
                      serverSideSearch
                      emptyText={clientiLoading ? "Ricerca in corso…" : "Nessun cliente trovato."}
                      className="w-full"
                    />

                  )}
                </div>

                {/* Flag Sinistro Terzi */}
                {selectedClienteId && (
                  <label className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30 cursor-pointer select-none">
                    <Checkbox
                      checked={!!watchSinistroTerzi}
                      onCheckedChange={(c) => setSinistroTerzi(!!c)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="text-sm font-medium">Sinistro Terzi</span>
                      <p className="text-xs text-muted-foreground">
                        Sinistro gestito senza collegamento a una polizza CBnet. La selezione polizza viene disabilitata.
                      </p>
                    </div>
                  </label>
                )}

                {/* Data accadimento (obbligatoria già in step 1) */}
                {selectedClienteId && (
                  <div className="space-y-2">
                    <Label htmlFor="data_evento">Data Accadimento *</Label>
                    <Input type="date" id="data_evento" {...register("data_evento")} />
                    {errors.data_evento && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.data_evento.message}
                      </p>
                    )}
                  </div>
                )}

                {/* 2) Selezione polizza del cliente — nascosta per Sinistro Terzi */}
                {selectedClienteId && !watchSinistroTerzi && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Label>Polizza del cliente {polizzeLoading && <span className="text-xs text-muted-foreground">(caricamento...)</span>}</Label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                        <Checkbox
                          checked={soloMadri}
                          onCheckedChange={(c) => {
                            const v = !!c;
                            setSoloMadri(v);
                            if (selectedClienteId) loadPolizzeForCliente(selectedClienteId, { soloMadri: v });
                          }}
                        />
                        <span>{soloMadri ? "Solo madri" : "Tutte le polizze (incluse quietanze)"}</span>
                      </label>
                    </div>
                    {polizzeList.length === 0 && !polizzeLoading ? (
                      <p className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
                        Nessuna polizza trovata per questo cliente. Puoi proseguire senza collegare una polizza.
                      </p>
                    ) : (
                      <SearchableSelect
                        options={polizzeList.map((p: any) => ({
                          value: p.id,
                          label: `${p.numero_titolo}${p.sostituisce_polizza ? " (quietanza)" : ""}`,
                          description: `${p.prodotti?.nome_prodotto || "—"}${p.prodotti?.compagnie?.nome ? " · " + p.prodotti.compagnie.nome : ""}${p.stato ? " · " + p.stato : ""}${p.data_competenza ? " · dec. " + p.data_competenza : ""}`,
                          searchText: `${p.numero_titolo} ${p.prodotti?.nome_prodotto || ""} ${p.stato || ""}`,
                        }))}
                        value={watchTitoloId ?? ""}
                        onValueChange={(val) => {
                          if (!val) {
                            setSelectedPolizzaData(null);
                            setValue("titolo_id", "");
                            return;
                          }
                          const selected = polizzeList.find((p: any) => p.id === val);
                          if (selected) {
                            setSelectedPolizzaData({ ...selected, clienti: selectedClienteData });
                            setValue("titolo_id", selected.id);
                          }
                        }}
                        placeholder="Seleziona una polizza del cliente..."
                        searchValue={polizzaSearchText}
                        onSearchChange={setPolizzaSearchText}
                        clearable={true}
                        clearLabel="— Nessuna Polizza —"
                        className="w-full"
                      />
                    )}
                  </div>
                )}

                {watchSinistroTerzi && selectedClienteId && (
                  <div className="p-3 border rounded-lg bg-amber-50 border-amber-200 text-xs text-amber-900">
                    <Badge variant="outline" className="mb-1 border-amber-400 text-amber-800">Sinistro Terzi</Badge>
                    <p>Pratica senza polizza CBnet. Compagnia e ufficio restano opzionali.</p>
                  </div>
                )}

                {/* Riepilogo polizza selezionata */}
                {!watchSinistroTerzi && selectedPolizzaData && (
                  <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
                    <h4 className="font-semibold text-sm text-primary">Polizza Selezionata per il Sinistro</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Numero Polizza:</span>
                        <p className="font-semibold">{selectedPolizzaData.numero_titolo}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Contraente:</span>
                        <p className="font-semibold">{resolveClienteNome(selectedPolizzaData.clienti || selectedClienteData)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stato Polizza:</span>
                        <p className="font-semibold capitalize"><Badge variant="outline">{selectedPolizzaData.stato}</Badge></p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ramo collegato:</span>
                        <p className="font-semibold">{formatPolizzaRamo(selectedPolizzaData)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Data di scadenza:</span>
                        <p className="font-semibold">{formatPolizzaScadenza(selectedPolizzaData)}</p>
                      </div>
                    </div>
                  </div>
                )}

                {errors.titolo_id && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertCircle className="h-3 w-3" /> {errors.titolo_id.message}
                  </p>
                )}
              </div>
            )}


            {/* STEP 2: DATI SINISTRO */}
            {currentStep === 2 && (
              <SinistroPraticaFormFields
                register={register}
                setValue={setValue}
                watch={watch}
                errors={errors}
                showDataEvento={false}
              />
            )}

            {/* STEP 3: DOCUMENTI INIZIALI */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/30 hover:bg-muted/10"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files?.length) {
                      processUploadedFiles(e.dataTransfer.files);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Trascina qui i tuoi documenti o clicca per sfogliare</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    PDF e immagini (JPG, PNG) — max {MAX_DOCUMENT_UPLOAD_MB} MB per file
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload-input"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    Seleziona File
                  </Button>
                </div>

                {watchDocumenti && watchDocumenti.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">File Caricati Temporaneamente:</h4>
                    <div className="space-y-3">
                      {docFields.map((field, idx) => (
                        <div key={field.id} className="p-3 border rounded-lg flex flex-col md:flex-row gap-3 items-start md:items-center bg-card shadow-sm">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <FileText className="h-5 w-5 text-primary shrink-0" />
                            <span className="text-xs font-semibold truncate" title={field.nome_file}>{field.nome_file}</span>
                          </div>
                          <div className="w-full md:w-48 shrink-0">
                            <Select 
                              value={watch(`documenti.${idx}.categoria`)} 
                              onValueChange={(val) => setValue(`documenti.${idx}.categoria`, val, { shouldValidate: true })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Tipo documento..." />
                              </SelectTrigger>
                              <SelectContent>
                                {lookupTipiDoc.map((type: any) => (
                                  <SelectItem key={type.id} value={type.codice}>{type.descrizione}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {errors.documenti?.[idx]?.categoria && (
                              <p className="text-[10px] text-destructive mt-0.5">{errors.documenti[idx]?.categoria?.message}</p>
                            )}
                          </div>
                          <div className="w-full md:flex-1">
                            <Input 
                              placeholder="Breve descrizione..." 
                              className="h-8 text-xs" 
                              {...register(`documenti.${idx}.descrizione`)}
                            />
                          </div>
                          <Button 
                            type="button" 
                            size="icon" 
                            variant="ghost" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => handleRemoveDocumento(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: ASSEGNAZIONE */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <SinistroPraticaFormFields
                  register={register}
                  setValue={setValue}
                  watch={watch}
                  errors={errors}
                  responsabiliList={responsabiliList}
                  liquidatoriList={liquidatoriList}
                  showEvento={false}
                  showAssegnazione
                  showNoteInterne
                />

                {/* Prescrizioni perentorie opzionali (oltre a quella biennale automatica verso agenzia) */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-primary">Prescrizioni perentorie (opzionale)</h4>
                  <p className="text-xs text-muted-foreground">
                    All&apos;apertura viene creata automaticamente la prescrizione biennale verso l&apos;agenzia di riferimento
                    della polizza (scadenza = data denuncia + 2 anni). Qui puoi aggiungere altre comunicazioni con scadenza.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="h-9 px-3 flex items-center text-sm rounded-md border bg-muted/30">
                      Destinatario: {DESTINATARIO_LABEL[PRESCRIZIONE_DESTINATARIO_AGENZIA]}
                    </div>
                    <Input
                      placeholder="Oggetto *"
                      className="h-9"
                      value={prescDraftForm.oggetto}
                      onChange={(e) => setPrescDraftForm({ ...prescDraftForm, oggetto: e.target.value })}
                    />
                    <Input
                      type="date"
                      className="h-9"
                      value={prescDraftForm.data_scadenza_risposta}
                      onChange={(e) => setPrescDraftForm({ ...prescDraftForm, data_scadenza_risposta: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        if (!prescDraftForm.oggetto.trim() || !prescDraftForm.data_scadenza_risposta) {
                          toast.error("Oggetto e scadenza sono obbligatori");
                          return;
                        }
                        setPrescrizioniDrafts([
                          ...prescrizioniDrafts,
                          {
                            ...prescDraftForm,
                            destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
                            destinatario_label:
                              labelAgenziaRiferimento(selectedPolizzaData) ||
                              selectedPolizzaData?.compagnie?.nome ||
                              selectedPolizzaData?.prodotti?.compagnie?.nome ||
                              prescDraftForm.destinatario_label,
                          },
                        ]);
                        setPrescDraftForm({
                          destinatario_tipo: PRESCRIZIONE_DESTINATARIO_AGENZIA,
                          oggetto: "",
                          data_scadenza_risposta: "",
                        });
                      }}
                    >
                      Aggiungi prescrizione
                    </Button>
                  </div>
                  {prescrizioniDrafts.length > 0 && (
                    <div className="space-y-1">
                      {prescrizioniDrafts.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs border rounded px-2 py-1.5">
                          <span>{DESTINATARIO_LABEL[p.destinatario_tipo]} — {p.oggetto}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPrescrizioniDrafts(prescrizioniDrafts.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reminder personali opzionali */}
                <div className="border rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-primary">Reminder sinistro (opzionale)</h4>
                  <p className="text-xs text-muted-foreground">Promemoria assegnato al responsabile sinistro con scadenza.</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Testo reminder *"
                      className="h-9 flex-1"
                      value={reminderDraftForm.testo}
                      onChange={(e) => setReminderDraftForm({ ...reminderDraftForm, testo: e.target.value })}
                    />
                    <Input
                      type="date"
                      className="h-9 w-36"
                      value={reminderDraftForm.data_scadenza || ""}
                      onChange={(e) => setReminderDraftForm({ ...reminderDraftForm, data_scadenza: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        if (!reminderDraftForm.testo.trim()) {
                          toast.error("Inserisci il testo del reminder");
                          return;
                        }
                        if (!reminderDraftForm.data_scadenza) {
                          toast.error("Inserisci la scadenza del reminder");
                          return;
                        }
                        setReminderDrafts([...reminderDrafts, { ...reminderDraftForm }]);
                        setReminderDraftForm({ testo: "", data_scadenza: "" });
                      }}
                    >
                      Aggiungi
                    </Button>
                  </div>
                  {reminderDrafts.length > 0 && (
                    <div className="space-y-1">
                      {reminderDrafts.map((r, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs border rounded px-2 py-1.5">
                          <span>{r.testo}{r.data_scadenza ? ` (${r.data_scadenza})` : ""}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setReminderDrafts(reminderDrafts.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 5: RIEPILOGO E CONFERMA */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex gap-3 items-start">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <h4 className="font-semibold text-primary">Pronto per l'Apertura</h4>
                    <p className="text-muted-foreground mt-0.5">Rivedi i dati inseriti. Puoi cliccare su "Modifica" a destra di ogni sezione per correggere eventuali informazioni.</p>
                  </div>
                </div>

                {/* Sezione 1: Polizza / Terzi */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex justify-between items-center border-b">
                    <span className="text-sm font-semibold text-primary">
                      {watchSinistroTerzi ? "1. Cliente (Sinistro Terzi)" : "1. Polizza e Cliente"}
                    </span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentStep(1)} className="text-xs h-7">Modifica</Button>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
                    {watchSinistroTerzi ? (
                      <>
                        <div>
                          <span className="text-muted-foreground">Tipo pratica</span>
                          <p className="font-semibold mt-0.5"><Badge variant="outline">Sinistro Terzi</Badge></p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cliente</span>
                          <p className="font-semibold mt-0.5">{resolveClienteNome(selectedClienteData)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Polizza CBnet</span>
                          <p className="font-semibold mt-0.5">Nessuna</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Data Accadimento</span>
                          <p className="font-semibold mt-0.5">{watch("data_evento") ? format(new Date(watch("data_evento")), "dd/MM/yyyy") : "—"}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-muted-foreground">Numero Polizza</span>
                          <p className="font-semibold mt-0.5">{selectedPolizzaData?.numero_titolo || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cliente</span>
                          <p className="font-semibold mt-0.5">{resolveClienteNome(selectedPolizzaData?.clienti || selectedClienteData)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Prodotto</span>
                          <p className="font-semibold mt-0.5">{selectedPolizzaData?.prodotti?.nome_prodotto || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Ramo collegato</span>
                          <p className="font-semibold mt-0.5">{selectedPolizzaData ? formatPolizzaRamo(selectedPolizzaData) : "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Data di scadenza</span>
                          <p className="font-semibold mt-0.5">{selectedPolizzaData ? formatPolizzaScadenza(selectedPolizzaData) : "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Data Accadimento</span>
                          <p className="font-semibold mt-0.5">{watch("data_evento") ? format(new Date(watch("data_evento")), "dd/MM/yyyy") : "—"}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Sezione 2: Dati Sinistro */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex justify-between items-center border-b">
                    <span className="text-sm font-semibold text-primary">2. Dati del Sinistro</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentStep(2)} className="text-xs h-7">Modifica</Button>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Data Denuncia</span>
                      <p className="font-semibold mt-0.5">{watch("data_denuncia") ? format(new Date(watch("data_denuncia")), "dd/MM/yyyy") : "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo Sinistro</span>
                      <p className="font-semibold mt-0.5">{formatTipoSinistro({ tipo_sinistro: watch("tipo_sinistro") === "__custom__" ? null : watch("tipo_sinistro"), tipo_sinistro_personalizzato: watch("tipo_sinistro_personalizzato") })}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Numero Compagnia</span>
                      <p className="font-semibold mt-0.5">{watch("numero_sinistro_compagnia") || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Controparte</span>
                      <p className="font-semibold mt-0.5">{watch("controparte") || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Targa</span>
                      <p className="font-semibold mt-0.5">{watch("targa_veicolo") || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Luogo</span>
                      <p className="font-semibold mt-0.5">{watch("luogo_sinistro") || watch("indirizzo_sinistro") || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Importo Riserva</span>
                      <p className="font-semibold mt-0.5 font-mono">
                        {watch("importo_riserva") ? `€ ${Number(watch("importo_riserva")).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}
                      </p>
                    </div>
                    <div className="col-span-1 md:col-span-3">
                      <span className="text-muted-foreground">Descrizione Accadimento</span>
                      <p className="mt-1 bg-muted/30 p-2.5 rounded border text-muted-foreground leading-relaxed">{watch("descrizione") || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Sezione 3: Documenti */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex justify-between items-center border-b">
                    <span className="text-sm font-semibold text-primary">3. Documenti allegati ({watchDocumenti?.length || 0})</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentStep(3)} className="text-xs h-7">Modifica</Button>
                  </div>
                  <div className="p-4 text-xs">
                    {watchDocumenti && watchDocumenti.length > 0 ? (
                      <div className="space-y-1.5">
                        {watchDocumenti.map((doc, idx) => (
                          <div key={idx} className="flex justify-between py-1 border-b last:border-0">
                            <span className="font-medium">{doc.nome_file}</span>
                            <span className="text-muted-foreground font-semibold">
                              {lookupTipiDoc.find((t: any) => t.codice === doc.categoria)?.descrizione || doc.categoria}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center italic py-2">Nessun documento caricato per questo sinistro.</p>
                    )}
                  </div>
                </div>

                {/* Sezione 4: Assegnazione */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex justify-between items-center border-b">
                    <span className="text-sm font-semibold text-primary">4. Gestione e Assegnazione</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentStep(4)} className="text-xs h-7">Modifica</Button>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Responsabile Interno</span>
                      <p className="font-semibold mt-0.5">
                        {(() => {
                          const resp = responsabiliList.find((r: any) => r.id === watch("responsabile_id"));
                          return resp ? `${resp.cognome || ""} ${resp.nome || ""}`.trim() : "—";
                        })()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Liquidatore Esterno</span>
                      <p className="font-semibold mt-0.5">
                        {(() => {
                          const liq = liquidatoriList.find((l: any) => l.id === watch("liquidatore_id"));
                          return liq ? liq.ragione_sociale || `${liq.cognome || ""} ${liq.nome || ""}`.trim() : "—";
                        })()}
                      </p>
                    </div>
                    {watch("note_interne") && (
                      <div className="col-span-1 md:col-span-2">
                        <span className="text-muted-foreground">Note Operatore</span>
                        <p className="mt-1 text-muted-foreground italic bg-muted/10 p-2 border rounded">{watch("note_interne")}</p>
                      </div>
                    )}
                    {(prescrizioniDrafts.length > 0 || reminderDrafts.length > 0) && (
                      <div className="col-span-1 md:col-span-2 space-y-2 pt-2 border-t">
                        {prescrizioniDrafts.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Prescrizioni ({prescrizioniDrafts.length})</span>
                            <ul className="mt-1 list-disc list-inside text-muted-foreground">
                              {prescrizioniDrafts.map((p, i) => (
                                <li key={i}>{DESTINATARIO_LABEL[p.destinatario_tipo]} — {p.oggetto}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {reminderDrafts.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">Reminder personali ({reminderDrafts.length})</span>
                            <ul className="mt-1 list-disc list-inside text-muted-foreground">
                              {reminderDrafts.map((r, i) => (
                                <li key={i}>{r.testo}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </CardContent>
          <CardFooter className="flex justify-between border-t py-4 bg-muted/10">
            {currentStep > 1 ? (
              <Button type="button" variant="outline" onClick={handlePrevStep} disabled={submitting}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Indietro
              </Button>
            ) : (
              <div /> // Spazio per layout
            )}

            {currentStep < 5 ? (
              <Button type="button" onClick={handleNextStep}>
                Avanti <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" className="btn-primary-gradient" disabled={submitting}>
                {submitting ? "Creazione in corso..." : "Conferma e Apri Sinistro"}
              </Button>
            )}
          </CardFooter>
        </Card>
      </form>

      {/* Modale AlertDialog di conferma per l'annullamento */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro di voler annullare?</AlertDialogTitle>
            <AlertDialogDescription>
              Tutti i dati non salvati andranno persi. La bozza locale del sinistro verrà definitivamente cancellata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnnulla} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Conferma Annullamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
