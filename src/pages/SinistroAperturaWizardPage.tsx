import { useState, useEffect } from "react";
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
import { TIPI_SINISTRO, formatTipoSinistro } from "@/lib/tipiSinistro";
import { Checkbox } from "@/components/ui/checkbox";
import AddressAutocomplete from "@/components/AddressAutocomplete";

const DRAFT_KEY = "sinistri:apertura:bozza";

// Tipi sinistro centralizzati in src/lib/tipiSinistro.ts

// Schema di validazione Zod
const wizardSchema = z.object({
  // Step 1
  titolo_id: z.string().optional(),
  
  // Step 2
  data_evento: z.string().min(1, "La data accadimento è obbligatoria"),
  data_denuncia: z.string().min(1, "La data denuncia è obbligatoria"),
  tipo_sinistro: z.string().optional(),
  tipo_sinistro_personalizzato: z.string().optional(),
  numero_sinistro_compagnia: z.string().optional(),
  descrizione: z.string().min(20, "La descrizione deve contenere almeno 20 caratteri"),
  luogo_sinistro: z.string().optional(),
  importo_riserva: z.preprocess((val) => (val === "" || val === undefined ? undefined : Number(val)), z.number().min(0, "L'importo non può essere negativo").optional()),
  
  // Step 3
  documenti: z.array(
    z.object({
      nome_file: z.string(),
      path_temp: z.string(), // path locale temporaneo o base64
      categoria: z.string().min(1, "La categoria è obbligatoria"),
      descrizione: z.string().optional(),
      file_base64: z.string().optional() // Usato per persistere il file nella bozza
    })
  ).optional(),
  
  // Step 4
  responsabile_id: z.string().optional(),
  liquidatore_id: z.string().optional(),
  note_interne: z.string().optional(),
  priorita: z.enum(["normale", "alta", "urgente"])
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

  // Stato ricerca cliente (Step 1)
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [selectedClienteData, setSelectedClienteData] = useState<any>(null);
  const [clientiSearchText, setClientiSearchText] = useState("");
  const [clientiList, setClientiList] = useState<any[]>([]);
  const [clientiLoading, setClientiLoading] = useState(false);

  // Inizializzazione React Hook Form
  const { register, control, handleSubmit, setValue, getValues, watch, trigger, formState: { errors } } = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      titolo_id: "",
      data_evento: "",
      data_denuncia: new Date().toISOString().slice(0, 10),
      tipo_sinistro: "",
      tipo_sinistro_personalizzato: "",
      numero_sinistro_compagnia: "",
      descrizione: "",
      luogo_sinistro: "",
      importo_riserva: undefined,
      documenti: [],
      responsabile_id: "",
      liquidatore_id: "",
      note_interne: "",
      priorita: "normale"
    }
  });

  // URL param for cliente preselection
  const [searchParams] = useSearchParams();
  const preselectedClienteId = searchParams.get('cliente_id');

  // Carica polizze (titoli + CGA) per un cliente
  const loadPolizzeForCliente = async (clienteId: string) => {
    setPolizzeLoading(true);
    try {
      const [titRes, cgaRes] = await Promise.all([
        supabase.from('titoli')
          .select(`id, numero_titolo, premio_lordo, stato, created_at, cliente_anagrafica_id, ufficio_id,
            prodotti(nome_prodotto, compagnie(id, nome)),
            clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente)`)
          .eq('stato', 'attivo')
          .eq('cliente_anagrafica_id', clienteId)
          .limit(100),
        supabase.from('polizza_cga')
          .select(`id, numero_polizza, data_decorrenza, premio_lordo_totale, cliente_id, prodotti_cga(nome_prodotto, compagnia, ramo)`)
          .eq('stato', 'approvato')
          .eq('cliente_id', clienteId)
          .limit(100),
      ]);
      const fromTitoli = (titRes.data ?? []).map((t: any) => ({ ...t, _isCga: false }));
      const fromCga = (cgaRes.data ?? []).map((c: any) => ({
        id: `cga:${c.id}`,
        numero_titolo: c.numero_polizza,
        stato: 'attivo',
        cliente_anagrafica_id: c.cliente_id,
        ufficio_id: null,
        prodotti: {
          nome_prodotto: c.prodotti_cga?.nome_prodotto,
          compagnie: { id: null, nome: c.prodotti_cga?.compagnia },
        },
        clienti: null,
        _isCga: true,
      }));
      setPolizzeList([...fromTitoli, ...fromCga].slice(0, 50));
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
  const watchDocumenti = watch("documenti");
  const watchValues = watch();

  // 1. Carica bozza se esistente
  useEffect(() => {
    const draft = loadDraft<WizardFormValues>(DRAFT_KEY);
    if (draft?.data) {
      const d = draft.data;
      Object.keys(d).forEach((key) => {
        setValue(key as keyof WizardFormValues, d[key]);
      });
      // Se c'è una polizza già selezionata nella bozza, carichiamo le sue info
      if (d.titolo_id) {
        supabase.from("titoli").select(`
          id, numero_titolo, premio_lordo, stato, created_at, cliente_anagrafica_id, ufficio_id,
          prodotti(nome_prodotto, compagnie(id, nome)),
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
  useDraftPersistence(DRAFT_KEY, watchValues, { enabled: draftLoaded });

  // Query per lookup tipo documento (Step 3)
  const { data: lookupTipiDoc = [] } = useQuery({
    queryKey: ["lookup-tipo-documento-wizard"],
    queryFn: async () => {
      const { data } = await supabase.from("lookup_tipo_documento").select("id, codice, descrizione").eq("attivo", true).order("descrizione");
      return data || [];
    }
  });

  // Query per lookup responsabili interni da profiles (Step 4)
  const { data: responsabiliList = [] } = useQuery({
    queryKey: ["profiles-responsabili-wizard"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome, ruolo").eq("attivo", true).order("cognome");
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
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Content = event.target?.result as string;
        // Appendiamo all'array del form
        appendDoc({
          nome_file: file.name,
          path_temp: URL.createObjectURL(file), // Usato temporaneamente per anteprima o download locale
          categoria: "",
          descrizione: "",
          file_base64: base64Content // Salvato nella bozza
        });
      };
      reader.readAsDataURL(file);
    });
    // Resettiamo l'input file
    e.target.value = "";
  };

  // Funzione per validare ed avanzare negli step
  const handleNextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (currentStep === 1) {
      // Polizza opzionale: nessuna validazione bloccante
      fieldsToValidate = [];
    } else if (currentStep === 2) {
      fieldsToValidate = ["data_evento", "data_denuncia", "descrizione", "importo_riserva"];
      // Validazione custom: serve tipo standard OPPURE personalizzato (min 3 char)
      const tStd = (getValues("tipo_sinistro") || "").trim();
      const tCustom = (getValues("tipo_sinistro_personalizzato") || "").trim();
      if (!tStd && tCustom.length < 3) {
        toast.error("Specifica il tipo sinistro (predefinito o personalizzato, min 3 caratteri)");
        return;
      }
    } else if (currentStep === 3) {
      fieldsToValidate = ["documenti"];
    } else if (currentStep === 4) {
      fieldsToValidate = ["priorita"];
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
      const compagniaId = selectedPolizzaData?.prodotti?.compagnie?.id || null;
      const clienteAnagraficaId = selectedPolizzaData?.cliente_anagrafica_id || null;
      const ufficioId = selectedPolizzaData?.ufficio_id || null;

      // 1. Creazione del sinistro tramite edge function unificata
      //    (checklist di default + log_attivita + evento timeline generati lato server)
      const { data: invokeRes, error: invokeErr } = await supabase.functions.invoke("gestione-sinistri", {
        body: {
          azione: "crea",
          titolo_id: values.titolo_id && !values.titolo_id.startsWith("cga:") ? values.titolo_id : null,
          cliente_anagrafica_id: clienteAnagraficaId,
          compagnia_id: compagniaId,
          ufficio_id: ufficioId,
          tipo_sinistro: (values.tipo_sinistro_personalizzato || "").trim() ? null : (values.tipo_sinistro || null),
          tipo_sinistro_personalizzato: (values.tipo_sinistro_personalizzato || "").trim() || null,
          descrizione: values.descrizione,
          luogo_sinistro: values.luogo_sinistro,
          data_evento: values.data_evento,
          data_denuncia: values.data_denuncia,
          numero_sinistro_compagnia: values.numero_sinistro_compagnia || undefined,
          importo_riserva: values.importo_riserva ?? null,
          responsabile_id: values.responsabile_id || null,
          liquidatore_id: values.liquidatore_id || null,
          priorita: values.priorita,
          note_interne: values.note_interne || undefined,
          user_id: user.id,
          stato_iniziale: "aperto",
        },
      });
      if (invokeErr) throw invokeErr;
      if (!invokeRes?.success) throw new Error(invokeRes?.error || "Errore creazione sinistro");
      const newSinistro = invokeRes.sinistro as { id: string; numero_sinistro: string };


      // 3. Upload documenti se presenti
      if (values.documenti && values.documenti.length > 0) {
        for (const doc of values.documenti) {
          if (!doc.file_base64) continue;
          
          // Convertiamo base64 in Blob
          const base64Data = doc.file_base64.split(",")[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: "application/octet-stream" });
          
          const storagePath = `sinistro/${newSinistro.id}/${Date.now()}_${doc.nome_file}`;
          
          // Upload su Supabase Storage bucket documenti_sinistri
          const { error: uploadErr } = await supabase.storage
            .from("documenti_sinistri")
            .upload(storagePath, blob);

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
            descrizione: doc.descrizione || null
          });

          if (docDbErr) throw docDbErr;
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

  const getClienteNome = (c: any) => {
    if (!c) return "—";
    if (c.tipo_cliente === "azienda" && c.ragione_sociale) return c.ragione_sociale;
    return `${c.cognome || ""} ${c.nome || ""}`.trim() || "—";
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
            <h1 className="text-xl font-bold">Apertura Nuovo Sinistro</h1>
            <p className="text-sm text-muted-foreground">Procedura guidata per l'apertura di un sinistro su polizza attiva</p>
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
                {stepIndex === 1 && "Polizza"}
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
              {currentStep === 1 && "Step 1: Cliente e Polizza"}
              {currentStep === 2 && "Step 2: Dettagli dell'Accadimento"}
              {currentStep === 3 && "Step 3: Documenti Iniziali"}
              {currentStep === 4 && "Step 4: Assegnazione Pratica e Priorità"}
              {currentStep === 5 && "Step 5: Riepilogo e Conferma"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Seleziona prima il cliente, poi scegli una delle sue polizze attive. La polizza è facoltativa."}
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
                        <p className="font-semibold">{getClienteNome(selectedClienteData)}</p>
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
                        label: getClienteNome(c) || "(senza nome)",
                        description: [c.codice_fiscale || c.partita_iva, c.tipo_cliente].filter(Boolean).join(" · "),
                        searchText: `${getClienteNome(c)} ${c.codice_fiscale || ""} ${c.partita_iva || ""}`,
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

                {/* 2) Selezione polizza del cliente */}
                {selectedClienteId && (
                  <div className="space-y-2">
                    <Label>Polizza del cliente {polizzeLoading && <span className="text-xs text-muted-foreground">(caricamento...)</span>}</Label>
                    {polizzeList.length === 0 && !polizzeLoading ? (
                      <p className="text-sm text-muted-foreground p-3 border rounded-lg bg-muted/30">
                        Nessuna polizza attiva trovata per questo cliente. Puoi proseguire senza collegare una polizza.
                      </p>
                    ) : (
                      <SearchableSelect
                        options={polizzeList.map((p: any) => ({
                          value: p.id,
                          label: p.numero_titolo,
                          description: `${p.prodotti?.nome_prodotto || "—"}${p.prodotti?.compagnie?.nome ? " · " + p.prodotti.compagnie.nome : ""}`,
                          searchText: `${p.numero_titolo} ${p.prodotti?.nome_prodotto || ""}`,
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

                {/* Riepilogo polizza selezionata */}
                {selectedPolizzaData && (
                  <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
                    <h4 className="font-semibold text-sm text-primary">Polizza Selezionata per il Sinistro</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Numero Polizza:</span>
                        <p className="font-semibold">{selectedPolizzaData.numero_titolo}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Contraente:</span>
                        <p className="font-semibold">{getClienteNome(selectedPolizzaData.clienti || selectedClienteData)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stato Polizza:</span>
                        <p className="font-semibold capitalize"><Badge variant="outline">{selectedPolizzaData.stato}</Badge></p>
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
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="data_evento">Data Accadimento *</Label>
                    <Input type="date" id="data_evento" {...register("data_evento")} />
                    {errors.data_evento && <p className="text-xs text-destructive">{errors.data_evento.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data_denuncia">Data Denuncia *</Label>
                    <Input type="date" id="data_denuncia" {...register("data_denuncia")} />
                    {errors.data_denuncia && <p className="text-xs text-destructive">{errors.data_denuncia.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo_sinistro">Tipo Sinistro *</Label>
                    {(watch("tipo_sinistro_personalizzato") || "").length > 0 || watch("tipo_sinistro") === "__custom__" ? (
                      <Input
                        id="tipo_sinistro_personalizzato"
                        placeholder="Descrivi il tipo di sinistro (min 3 caratteri)"
                        value={watch("tipo_sinistro_personalizzato") || ""}
                        onChange={(e) => {
                          setValue("tipo_sinistro_personalizzato", e.target.value, { shouldValidate: true });
                          setValue("tipo_sinistro", "", { shouldValidate: true });
                        }}
                        maxLength={500}
                      />
                    ) : (
                      <SearchableSelect
                        options={TIPI_SINISTRO.map(t => ({ value: t.value, label: t.label }))}
                        value={watch("tipo_sinistro") || ""}
                        onValueChange={(val) => setValue("tipo_sinistro", val, { shouldValidate: true })}
                        placeholder="Seleziona tipo sinistro..."
                        searchPlaceholder="Cerca tipo..."
                      />
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox
                        id="usa_tipo_personalizzato"
                        checked={(watch("tipo_sinistro_personalizzato") || "").length > 0 || watch("tipo_sinistro") === "__custom__"}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setValue("tipo_sinistro", "__custom__");
                          } else {
                            setValue("tipo_sinistro", "");
                            setValue("tipo_sinistro_personalizzato", "");
                          }
                        }}
                      />
                      <Label htmlFor="usa_tipo_personalizzato" className="text-xs font-normal cursor-pointer">
                        Tipo non in elenco (personalizzato)
                      </Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero_sinistro_compagnia">Numero Sinistro Compagnia (opzionale)</Label>
                    <Input id="numero_sinistro_compagnia" placeholder="Es. AN-2026-X8" {...register("numero_sinistro_compagnia")} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="luogo_sinistro">Luogo Accadimento</Label>
                    <AddressAutocomplete
                      value={watch("luogo_sinistro") || ""}
                      onChange={(v) => setValue("luogo_sinistro", v, { shouldValidate: true })}
                      onSelect={(c) => {
                        const full = [c.indirizzo, c.cap, c.citta, c.provincia].filter(Boolean).join(", ");
                        setValue("luogo_sinistro", full, { shouldValidate: true });
                      }}
                      placeholder="Inizia a digitare via, piazza, città..."
                    />
                    {errors.luogo_sinistro && <p className="text-xs text-destructive">{errors.luogo_sinistro.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="importo_riserva">Importo Riserva Iniziale (€, opzionale)</Label>
                    <Input type="number" step="0.01" id="importo_riserva" placeholder="0.00" {...register("importo_riserva")} />
                    {errors.importo_riserva && <p className="text-xs text-destructive">{errors.importo_riserva.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="descrizione">Descrizione Accadimento (min 20 caratteri) *</Label>
                  <Textarea 
                    id="descrizione" 
                    placeholder="Descrivi dettagliatamente come e cosa è accaduto..." 
                    rows={4} 
                    {...register("descrizione")}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {(watch("descrizione") || "").length}/20 caratteri minimi
                  </p>
                  {errors.descrizione && <p className="text-xs text-destructive">{errors.descrizione.message}</p>}
                </div>
              </div>
            )}

            {/* STEP 3: DOCUMENTI INIZIALI */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 text-center hover:bg-muted/10 transition-colors">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Trascina qui i tuoi documenti o clicca per sfogliare</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Supportati file PDF, immagini (JPG, PNG)</p>
                  <Input 
                    type="file" 
                    multiple 
                    accept=".pdf,image/*" 
                    onChange={handleFileUpload} 
                    className="hidden" 
                    id="file-upload-input"
                  />
                  <Label htmlFor="file-upload-input" asChild>
                    <Button type="button" variant="secondary">Seleziona File</Button>
                  </Label>
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
                            onClick={() => removeDoc(idx)}
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
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Responsabile Interno <span className="text-muted-foreground text-xs">(facoltativo)</span></Label>
                    <SearchableSelect
                      value={watch("responsabile_id")}
                      onValueChange={(val) => setValue("responsabile_id", val, { shouldValidate: true })}
                      placeholder="Seleziona responsabile..."
                      options={responsabiliList.map((r: any) => ({
                        value: r.id,
                        label: `${r.cognome || ""} ${r.nome || ""}`.trim(),
                        description: `Ruolo: ${r.ruolo}`
                      }))}
                    />
                    {errors.responsabile_id && <p className="text-xs text-destructive">{errors.responsabile_id.message}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label>Liquidatore Esterno <span className="text-muted-foreground text-xs">(facoltativo)</span></Label>
                    <SearchableSelect
                      value={watch("liquidatore_id")}
                      onValueChange={(val) => setValue("liquidatore_id", val, { shouldValidate: true })}
                      placeholder="Seleziona liquidatore..."
                      options={liquidatoriList.map((l: any) => ({
                        value: l.id,
                        label: l.ragione_sociale || `${l.cognome || ""} ${l.nome || ""}`.trim()
                      }))}
                    />
                    {errors.liquidatore_id && <p className="text-xs text-destructive">{errors.liquidatore_id.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Priorità di Apertura *</Label>
                  <RadioGroup 
                    value={watch("priorita")} 
                    onValueChange={(val) => setValue("priorita", val as any)}
                    className="grid grid-cols-3 gap-4 pt-2"
                  >
                    <Label htmlFor="priorita-normale" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/30">
                      <RadioGroupItem value="normale" id="priorita-normale" />
                      <span>Normale</span>
                    </Label>
                    <Label htmlFor="priorita-alta" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 text-orange-600">
                      <RadioGroupItem value="alta" id="priorita-alta" />
                      <span>Alta</span>
                    </Label>
                    <Label htmlFor="priorita-urgente" className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-muted/30 text-destructive">
                      <RadioGroupItem value="urgente" id="priorita-urgente" />
                      <span className="font-bold">Urgente</span>
                    </Label>
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note_interne">Note Interne Operatore (opzionale)</Label>
                  <Textarea 
                    id="note_interne" 
                    placeholder="Annotazioni non visibili al cliente..." 
                    rows={3} 
                    {...register("note_interne")}
                  />
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

                {/* Sezione 1: Polizza */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-muted px-4 py-2 flex justify-between items-center border-b">
                    <span className="text-sm font-semibold text-primary">1. Polizza e Cliente</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCurrentStep(1)} className="text-xs h-7">Modifica</Button>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-muted-foreground">Numero Polizza</span>
                      <p className="font-semibold mt-0.5">{selectedPolizzaData?.numero_titolo || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cliente</span>
                      <p className="font-semibold mt-0.5">{selectedPolizzaData ? getClienteNome(selectedPolizzaData.clienti) : "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prodotto</span>
                      <p className="font-semibold mt-0.5">{selectedPolizzaData?.prodotti?.nome_prodotto || "—"}</p>
                    </div>
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
                      <span className="text-muted-foreground">Data Accadimento</span>
                      <p className="font-semibold mt-0.5">{watch("data_evento") ? format(new Date(watch("data_evento")), "dd/MM/yyyy") : "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data Denuncia</span>
                      <p className="font-semibold mt-0.5">{watch("data_denuncia") ? format(new Date(watch("data_denuncia")), "dd/MM/yyyy") : "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo Sinistro</span>
                      <p className="font-semibold mt-0.5 capitalize">{(TIPI_SINISTRO.find(t => t.value === watch("tipo_sinistro"))?.label) || watch("tipo_sinistro")?.replace(/_/g, " ") || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Numero Compagnia</span>
                      <p className="font-semibold mt-0.5">{watch("numero_sinistro_compagnia") || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Luogo</span>
                      <p className="font-semibold mt-0.5">{watch("luogo_sinistro") || "—"}</p>
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
                  <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
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
                    <div>
                      <span className="text-muted-foreground">Priorità</span>
                      <p className="font-semibold mt-0.5 capitalize">
                        <Badge variant={watch("priorita") === "urgente" ? "destructive" : watch("priorita") === "alta" ? "default" : "outline"}>
                          {watch("priorita")}
                        </Badge>
                      </p>
                    </div>
                    {watch("note_interne") && (
                      <div className="col-span-1 md:col-span-3">
                        <span className="text-muted-foreground">Note Operatore</span>
                        <p className="mt-1 text-muted-foreground italic bg-muted/10 p-2 border rounded">{watch("note_interne")}</p>
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
