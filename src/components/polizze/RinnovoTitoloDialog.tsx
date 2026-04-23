import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Calendar, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface RinnovoTitoloDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titolo: any;
}

// Calcola la nuova data di scadenza in base a periodicita + anni_durata
function calcolaNuovaScadenza(durataDa: string, periodicita: string | null, anniDurata: number | null): string {
  const d = new Date(durataDa);
  const p = (periodicita || "annuale").toLowerCase();
  const anni = anniDurata && anniDurata > 0 ? anniDurata : 1;

  if (p.startsWith("annu")) {
    d.setFullYear(d.getFullYear() + anni);
  } else if (p.startsWith("semestr")) {
    d.setMonth(d.getMonth() + 6);
  } else if (p.startsWith("quadrimestr")) {
    d.setMonth(d.getMonth() + 4);
  } else if (p.startsWith("trimestr")) {
    d.setMonth(d.getMonth() + 3);
  } else if (p.startsWith("mensil")) {
    d.setMonth(d.getMonth() + 1);
  } else {
    d.setFullYear(d.getFullYear() + anni);
  }
  return d.toISOString().slice(0, 10);
}

export function RinnovoTitoloDialog({ open, onOpenChange, titolo }: RinnovoTitoloDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();

  const [conflittoRinnovo, setConflittoRinnovo] = useState<{
    id: string;
    numero_titolo: string;
    riga: number | null;
    data_scadenza: string | null;
    stato: string | null;
    data_messa_cassa: string | null;
  } | null>(null);

  const [t, setT] = useState<any>(titolo || {});
  const oldDurataA = t.durata_a || t.data_scadenza || "";

  const [form, setForm] = useState({
    durata_da: "",
    durata_a: "",
    data_scadenza: "",
    data_competenza: "",
    garanzia_da: "",
    garanzia_a: "",
    premio_lordo: "" as string,
    premio_netto: "" as string,
    tasse: "" as string,
    addizionali: "" as string,
    provvigioni: "" as string,
  });

  // All'apertura: rifetch fresco del titolo dal DB per essere sicuri di usare i valori
  // più aggiornati (es. premio modificato dopo aver aperto la pagina).
  useEffect(() => {
    if (!open || !titolo?.id) return;
    let cancelled = false;
    (async () => {
      const { data: fresh } = await supabase
        .from("titoli")
        .select("*, cliente_anagrafica:clienti!cliente_anagrafica_id(ragione_sociale,cognome,nome), compagnia_diretta:compagnie!compagnia_id(nome), prodotti(compagnie(nome))")
        .eq("id", titolo.id)
        .maybeSingle();
      if (cancelled) return;
      const tt = fresh || titolo;
      setT(tt);

      const nuovaDa = tt.durata_a || tt.data_scadenza || "";
      if (!nuovaDa) return;
      const nuovaA = calcolaNuovaScadenza(nuovaDa, tt.periodicita, tt.anni_durata);

      // Garanzia: stesso delta tra garanzia_da -> garanzia_a applicato a partire dalla nuova durata
      let garDa = nuovaDa;
      let garA = nuovaA;
      if (tt.garanzia_da && tt.garanzia_a) {
        const oldGarDa = new Date(tt.garanzia_da);
        const oldDurDa = new Date(tt.durata_da);
        const offset = oldGarDa.getTime() - oldDurDa.getTime();
        const newGarDa = new Date(new Date(nuovaDa).getTime() + offset);
        garDa = newGarDa.toISOString().slice(0, 10);
        garA = calcolaNuovaScadenza(garDa, tt.periodicita, tt.anni_durata);
      }

      // Usa i valori CORRENTI della polizza (quelli mostrati/modificati nella UI principale)
      // come fonte di verità. Fallback ai _quietanza solo se il campo principale è null.
      const premioNettoBase = tt.premio_netto ?? tt.premio_netto_quietanza ?? 0;
      const tasseBase = tt.tasse ?? tt.tasse_quietanza ?? 0;
      const addizBase = tt.addizionali ?? tt.addizionali_quietanza ?? 0;
      const provvBase = tt.provvigioni_firma ?? tt.provvigioni_quietanza ?? 0;
      // Premio lordo: usa il valore aggiornato sul titolo, altrimenti ricalcola
      const lordoBase = tt.premio_lordo ?? (Number(premioNettoBase) + Number(tasseBase) + Number(addizBase));

      setForm({
        durata_da: nuovaDa,
        durata_a: nuovaA,
        data_scadenza: nuovaA,
        data_competenza: nuovaDa,
        garanzia_da: garDa,
        garanzia_a: garA,
        premio_lordo: String(Number(lordoBase) || 0),
        premio_netto: String(Number(premioNettoBase) || 0),
        tasse: String(Number(tasseBase) || 0),
        addizionali: String(Number(addizBase) || 0),
        provvigioni: String(Number(provvBase) || 0),
      });
    })();
    return () => { cancelled = true; };
  }, [open, titolo?.id]);

  const rinnovaMutation = useMutation({
    mutationFn: async () => {
      // Recupera l'utente corrente e il suo ufficio per rispettare le RLS
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Utente non autenticato");

      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("ufficio_id")
        .eq("id", userId)
        .single();
      if (profErr) throw profErr;
      const myUfficioId = (profile as any)?.ufficio_id;
      let ufficioPerRinnovo: string | null = myUfficioId ?? null;
      if (!ufficioPerRinnovo) {
        if (isAdmin) {
          // Admin senza Sede sul profilo: eredita la Sede dalla polizza origine
          ufficioPerRinnovo = (t as any).ufficio_id ?? null;
          if (!ufficioPerRinnovo) {
            throw new Error("Né l'utente né il titolo origine hanno una Sede: impossibile creare il rinnovo.");
          }
        } else {
          throw new Error("Sede dell'utente non configurata: contatta l'amministratore");
        }
      }

      // Anti-duplicato: verifica che non esista già un rinnovo per stesso numero+compagnia+scadenza
      const { data: esistente, error: dupErr } = await supabase
        .from("titoli")
        .select("id, numero_titolo, riga, data_scadenza, stato, data_messa_cassa")
        .eq("numero_titolo", t.numero_titolo)
        .eq("compagnia_id", t.compagnia_id)
        .eq("data_scadenza", form.data_scadenza)
        .maybeSingle();
      if (dupErr) throw dupErr;
      if (esistente?.id) {
        const err: any = new Error(
          `Esiste già un rinnovo della polizza ${t.numero_titolo} con scadenza ${form.data_scadenza}. Apri il titolo esistente invece di crearne uno nuovo.`
        );
        err.titoloEsistenteId = esistente.id;
        err.titoloEsistente = esistente;
        throw err;
      }

      // Trova la riga massima per quel numero_titolo
      const { data: maxRow, error: maxErr } = await supabase
        .from("titoli")
        .select("riga")
        .eq("numero_titolo", t.numero_titolo)
        .order("riga", { ascending: false })
        .limit(1);
      if (maxErr) throw maxErr;
      const nuovaRiga = ((maxRow?.[0]?.riga as number | null) ?? 0) + 1;

      const insertPayload: any = {
        numero_titolo: t.numero_titolo,
        riga: nuovaRiga,
        cliente_anagrafica_id: t.cliente_anagrafica_id,
        cliente_id: t.cliente_id,
        prodotto_nome: t.prodotto_nome,
        ufficio_id: ufficioPerRinnovo,
        produttore_id: t.produttore_id,
        compagnia_id: t.compagnia_id,
        ramo_id: t.ramo_id,
        gruppo_ramo: t.gruppo_ramo,
        specialist: t.specialist,
        commerciale_id: t.commerciale_id,
        percentuale_commerciale: t.percentuale_commerciale,
        percentuale_riparto: t.percentuale_riparto,
        tipo_mandatario: t.tipo_mandatario,
        anni_durata: t.anni_durata,
        rate: t.rate,
        periodicita: t.periodicita,
        tipo_rinnovo: t.tipo_rinnovo,
        tacito_rinnovo: t.tacito_rinnovo ?? true,
        disdetta_mesi: t.disdetta_mesi,
        descrizione_polizza: t.descrizione_polizza,
        targa_telaio: t.targa_telaio,
        risk_type: t.risk_type,
        valuta: t.valuta,
        // Date nuove
        durata_da: form.durata_da,
        durata_a: form.durata_a,
        data_scadenza: form.data_scadenza,
        data_competenza: form.data_competenza,
        garanzia_da: form.garanzia_da || null,
        garanzia_a: form.garanzia_a || null,
        // Premi - sia firma che quietanza vengono inizializzati con i valori confermati nel form,
        // così il nuovo titolo nasce già "allineato" (la quietanza riflette il premio corrente).
        premio_lordo: parseFloat(form.premio_lordo) || 0,
        premio_netto: parseFloat(form.premio_netto) || 0,
        tasse: parseFloat(form.tasse) || 0,
        addizionali: parseFloat(form.addizionali) || 0,
        provvigioni_firma: parseFloat(form.provvigioni) || 0,
        premio_netto_quietanza: parseFloat(form.premio_netto) || 0,
        tasse_quietanza: parseFloat(form.tasse) || 0,
        addizionali_quietanza: parseFloat(form.addizionali) || 0,
        provvigioni_quietanza: parseFloat(form.provvigioni) || 0,
        // Stato nuovo: il rinnovo nasce IN ATTESA. Verrà attivato automaticamente
        // dal trigger DB `trg_attiva_rinnovo_su_messa_cassa` quando la polizza
        // origine viene messa a cassa (stato = 'incassato').
        stato: "in_attesa_rinnovo",
        data_incasso: null,
        importo_incassato: null,
        tipo_portafoglio: "rinnovo",
        // Riferimento al precedente (usato dal trigger di attivazione automatica)
        sostituisce_polizza: t.numero_titolo,
        sostituisce_riga: t.riga,
      };

      const { data: nuovo, error: insErr } = await supabase
        .from("titoli")
        .insert(insertPayload)
        .select("id")
        .single();
      if (insErr) {
        console.error("Errore insert titoli in rinnovo", {
          error: insErr,
          userId,
          myUfficioId,
          titoloOrigineId: t.id,
          titoloOrigineUfficioId: t.ufficio_id,
          insertPayload,
        });
        throw insErr;
      }

      // Trova il movimento origine (ultimo movimento del titolo precedente) per sostituisce_id
      // sostituisce_id è una FK verso movimenti_polizza.id, NON verso titoli.id
      const { data: movOrigine, error: movOrigErr } = await supabase
        .from("movimenti_polizza")
        .select("id")
        .eq("titolo_id", t.id)
        .order("data_movimento", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (movOrigErr) {
        console.warn("Nessun movimento origine trovato per il titolo, sostituisce_id sarà null", movOrigErr);
      }
      const sostituisceMovId = (movOrigine as any)?.id ?? null;

      // Movimento di rinnovo
      const { data: nuovoMov, error: movErr } = await supabase
        .from("movimenti_polizza")
        .insert({
          titolo_id: nuovo.id,
          riga: nuovaRiga,
          tipo: "Rinnovo",
          tipo_documento: "PQ",
          data_movimento: new Date().toISOString().slice(0, 10),
          data_effetto: form.durata_da,
          data_scadenza: form.durata_a,
          data_rinnovo: form.durata_da,
          premio: parseFloat(form.premio_lordo) || 0,
          premio_netto: parseFloat(form.premio_netto) || 0,
          tasse: parseFloat(form.tasse) || 0,
          stato: "aperto",
          sostituisce_id: sostituisceMovId,
          ufficio_id: ufficioPerRinnovo,
        })
        .select("id")
        .single();
      if (movErr) {
        console.error("Errore insert movimenti_polizza in rinnovo", {
          error: movErr,
          userId,
          myUfficioId,
          titoloOrigineId: t.id,
          titoloOrigineUfficioId: t.ufficio_id,
          nuovoTitoloId: nuovo.id,
          sostituisceMovId,
        });
        throw movErr;
      }

      // Legame bidirezionale: aggiorna il movimento origine con sostituito_da_id (best-effort)
      if (sostituisceMovId && nuovoMov?.id) {
        const { error: updOrigErr } = await supabase
          .from("movimenti_polizza")
          .update({ sostituito_da_id: nuovoMov.id })
          .eq("id", sostituisceMovId);
        if (updOrigErr) {
          console.warn("Impossibile aggiornare sostituito_da_id sul movimento origine", updOrigErr);
        }
      }

      try {
        await logAttivita({
        azione: "rinnovo_polizza",
        entita_tipo: "titolo",
        entita_id: nuovo.id,
        dettagli_json: {
          polizza: t.numero_titolo,
          riga_origine: t.riga,
          riga_nuova: nuovaRiga,
          durata_da: form.durata_da,
          durata_a: form.durata_a,
          premio_lordo: parseFloat(form.premio_lordo) || 0,
        },
        });
      } catch (logError) {
        console.error("Errore log_attivita in rinnovo", {
          error: logError,
          userId,
          myUfficioId,
          nuovoTitoloId: nuovo.id,
        });
        throw logError;
      }

      return nuovo.id as string;
    },
    onSuccess: (nuovoId) => {
      toast.success("Rinnovo creato — diventerà attivo alla messa a cassa della polizza precedente");
      queryClient.invalidateQueries({ queryKey: ["titolo"] });
      queryClient.invalidateQueries({ queryKey: ["portafoglio-carico"] });
      onOpenChange(false);
      navigate(`/titoli/${nuovoId}`);
    },
    onError: (e: any) => {
      console.error(e);
      // Caso 1: duplicato rilevato applicativamente (con titoloEsistenteId)
      if (e?.titoloEsistenteId) {
        // Admin: offri override "Elimina e rifai"
        if (isAdmin && e?.titoloEsistente) {
          setConflittoRinnovo(e.titoloEsistente);
          return;
        }
        toast.error(e.message, {
          action: {
            label: "Vai al titolo esistente",
            onClick: () => {
              onOpenChange(false);
              navigate(`/titoli/${e.titoloEsistenteId}`);
            },
          },
          duration: 8000,
        });
        return;
      }
      // Caso 2: vincolo unique a livello DB (race condition / doppio click)
      if (e?.code === "23505" || /duplicat/i.test(e?.message || "")) {
        toast.error(
          `Rinnovo già esistente per la polizza ${t.numero_titolo} con scadenza ${form.data_scadenza}.`
        );
        return;
      }
      toast.error("Errore nel rinnovo: " + (e?.message || "sconosciuto"));
    },
  });

  // Mutation admin: elimina rinnovo esistente e ne crea uno nuovo
  const eliminaERifaiMutation = useMutation({
    mutationFn: async () => {
      if (!conflittoRinnovo) throw new Error("Nessun conflitto da risolvere");
      if (!isAdmin) throw new Error("Solo gli amministratori possono eseguire questa operazione");

      // Safety: rifetch stato/data_messa_cassa fresh
      const { data: fresh, error: freshErr } = await supabase
        .from("titoli")
        .select("id, stato, data_messa_cassa, numero_titolo, data_scadenza")
        .eq("id", conflittoRinnovo.id)
        .single();
      if (freshErr) throw freshErr;
      if ((fresh as any).data_messa_cassa) {
        throw new Error("Il rinnovo esistente è già stato incassato (messo a cassa). Non è eliminabile: usa Storno.");
      }
      if (!["in_attesa_rinnovo", "attivo"].includes((fresh as any).stato || "")) {
        throw new Error(`Il rinnovo esistente ha stato '${(fresh as any).stato}' e non può essere eliminato automaticamente.`);
      }

      // Trova movimenti del titolo esistente per resettare i back-link sostituito_da_id
      const { data: movs, error: movsErr } = await supabase
        .from("movimenti_polizza")
        .select("id, sostituisce_id")
        .eq("titolo_id", (fresh as any).id);
      if (movsErr) throw movsErr;

      // Reset sostituito_da_id sui movimenti origine referenziati
      const sostituisceIds = (movs || [])
        .map((m: any) => m.sostituisce_id)
        .filter((x: any): x is string => !!x);
      if (sostituisceIds.length > 0) {
        const { error: resetErr } = await supabase
          .from("movimenti_polizza")
          .update({ sostituito_da_id: null })
          .in("id", sostituisceIds);
        if (resetErr) console.warn("Impossibile resettare sostituito_da_id origine", resetErr);
      }

      // Elimina movimenti del titolo (preventivo, anche se ON DELETE CASCADE)
      const { error: delMovErr } = await supabase
        .from("movimenti_polizza")
        .delete()
        .eq("titolo_id", (fresh as any).id);
      if (delMovErr) throw delMovErr;

      // Elimina il titolo esistente
      const { error: delTitErr } = await supabase
        .from("titoli")
        .delete()
        .eq("id", (fresh as any).id);
      if (delTitErr) throw delTitErr;

      // Log eliminazione
      try {
        await logAttivita({
          azione: "rinnovo_eliminato",
          entita_tipo: "titolo",
          entita_id: (fresh as any).id,
          dettagli_json: {
            polizza: (fresh as any).numero_titolo,
            data_scadenza: (fresh as any).data_scadenza,
            motivo: "admin_override_rifai_rinnovo",
            titolo_origine_id: t.id,
          },
          severity: "warning",
        });
      } catch (logErr) {
        console.error("Errore log eliminazione rinnovo", logErr);
      }
    },
    onSuccess: async () => {
      setConflittoRinnovo(null);
      toast.success("Rinnovo precedente eliminato. Creazione del nuovo in corso...");
      // Rilancia la creazione del rinnovo
      rinnovaMutation.mutate();
    },
    onError: (e: any) => {
      console.error(e);
      toast.error(e?.message || "Impossibile eliminare il rinnovo esistente");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" /> Rinnovo Polizza
          </DialogTitle>
          <DialogDescription>
            Stai duplicando la polizza per il periodo successivo. I dati sono precompilati in base a durata e
            frazionamento attuali e possono essere modificati prima della conferma.
          </DialogDescription>
        </DialogHeader>

        {/* Riepilogo polizza */}
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Polizza</span>
            <span className="font-mono font-semibold">{t.numero_titolo} / riga {t.riga ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cliente</span>
            <span className="font-medium">
              {t.cliente_anagrafica?.ragione_sociale ||
                `${t.cliente_anagrafica?.cognome || ""} ${t.cliente_anagrafica?.nome || ""}`.trim() ||
                "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Compagnia</span>
            <span>{t.compagnia_diretta?.nome || t.prodotti?.compagnie?.nome || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Periodo attuale</span>
            <span>
              {t.durata_da} → {t.durata_a}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frazionamento</span>
            <span>{t.periodicita || "—"} ({t.anni_durata || 1} anno/i)</span>
          </div>
        </div>

        {/* Form nuovo periodo */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Calendar className="w-4 h-4" /> Nuovo Periodo
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Durata Da</Label>
              <Input
                type="date"
                value={form.durata_da}
                onChange={(e) => {
                  const v = e.target.value;
                  const nuovoA = calcolaNuovaScadenza(v, t.periodicita, t.anni_durata);
                  setForm((f) => ({ ...f, durata_da: v, durata_a: nuovoA, data_scadenza: nuovoA, data_competenza: v }));
                }}
              />
            </div>
            <div>
              <Label className="text-xs">Durata A</Label>
              <Input
                type="date"
                value={form.durata_a}
                onChange={(e) => setForm((f) => ({ ...f, durata_a: e.target.value, data_scadenza: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Data Scadenza</Label>
              <Input
                type="date"
                value={form.data_scadenza}
                onChange={(e) => setForm((f) => ({ ...f, data_scadenza: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Data Competenza</Label>
              <Input
                type="date"
                value={form.data_competenza}
                onChange={(e) => setForm((f) => ({ ...f, data_competenza: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Garanzia Da</Label>
              <Input
                type="date"
                value={form.garanzia_da}
                onChange={(e) => setForm((f) => ({ ...f, garanzia_da: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Garanzia A</Label>
              <Input
                type="date"
                value={form.garanzia_a}
                onChange={(e) => setForm((f) => ({ ...f, garanzia_a: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={rinnovaMutation.isPending}>
            Annulla
          </Button>
          <Button
            onClick={() => rinnovaMutation.mutate()}
            disabled={rinnovaMutation.isPending || !form.durata_da || !form.durata_a}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            {rinnovaMutation.isPending ? "Creazione..." : "Conferma Rinnovo"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* AlertDialog admin: conflitto rinnovo esistente */}
      <AlertDialog open={!!conflittoRinnovo} onOpenChange={(o) => !o && setConflittoRinnovo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Esiste già un rinnovo
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Per la polizza <span className="font-mono font-semibold">{conflittoRinnovo?.numero_titolo}</span>{" "}
                  con scadenza <span className="font-semibold">{conflittoRinnovo?.data_scadenza}</span> esiste già
                  un rinnovo (riga {conflittoRinnovo?.riga ?? "—"}, stato{" "}
                  <span className="font-semibold">{conflittoRinnovo?.stato}</span>).
                </p>
                <p className="text-destructive font-medium">
                  Confermando, il rinnovo esistente verrà <strong>eliminato</strong> insieme ai suoi movimenti, e
                  ne verrà creato uno nuovo con i dati attualmente compilati. Operazione irreversibile.
                </p>
                <p>
                  Vuoi procedere oppure aprire il rinnovo esistente?
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={eliminaERifaiMutation.isPending}>Annulla</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={eliminaERifaiMutation.isPending}
              onClick={() => {
                const id = conflittoRinnovo?.id;
                setConflittoRinnovo(null);
                if (id) {
                  onOpenChange(false);
                  navigate(`/titoli/${id}`);
                }
              }}
            >
              Vai al titolo esistente
            </Button>
            <AlertDialogAction
              disabled={eliminaERifaiMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                eliminaERifaiMutation.mutate();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {eliminaERifaiMutation.isPending ? "Eliminazione..." : "Elimina e rifai (admin)"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
