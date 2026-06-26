import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { Pencil, X, Save } from "lucide-react";
import SinistroPraticaFormFields from "@/components/sinistri/SinistroPraticaFormFields";
import { formatTipoSinistro } from "@/lib/tipiSinistro";
import {
  sinistroPraticaSchema,
  sinistroRowToPraticaValues,
  praticaValuesToDbPayload,
  validateTipoSinistro,
  type SinistroPraticaValues,
} from "@/lib/sinistroPraticaSchema";

interface SinistroRow {
  id: string;
  stato?: string;
  data_evento?: string | null;
  data_denuncia?: string | null;
  tipo_sinistro?: string | null;
  tipo_sinistro_personalizzato?: string | null;
  numero_sinistro_compagnia?: string | null;
  descrizione?: string | null;
  dinamica?: string | null;
  luogo_sinistro?: string | null;
  indirizzo_sinistro?: string | null;
  citta_sinistro?: string | null;
  cap_sinistro?: string | null;
  provincia_sinistro?: string | null;
  controparte?: string | null;
  targa_veicolo?: string | null;
  importo_riserva?: number | null;
  costo_preventivato?: number | null;
  costo_effettivo?: number | null;
  franchigia?: number | null;
  importo_liquidato?: number | null;
  responsabile_id?: string | null;
  liquidatore_id?: string | null;
  note_interne?: string | null;
  profiles?: { nome?: string; cognome?: string } | null;
  liquidatore?: { nome?: string; cognome?: string; ragione_sociale?: string } | null;
}

interface Props {
  sinistro: SinistroRow;
  canEdit: boolean;
  onSaved: () => void;
}

const fmtDate = (d?: string | null) => (d ? format(new Date(d), "dd/MM/yyyy") : "—");
const fmtEuro = (n?: number | null) =>
  n != null ? `€ ${Number(n).toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—";

function ReadOnlyGrid({ sinistro }: { sinistro: SinistroRow }) {
  const descrizione = sinistro.descrizione || sinistro.dinamica;
  const luogo = sinistro.indirizzo_sinistro || sinistro.luogo_sinistro;
  const luogoExtra = [sinistro.cap_sinistro, sinistro.citta_sinistro, sinistro.provincia_sinistro ? `(${sinistro.provincia_sinistro})` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div><span className="text-muted-foreground">Data accadimento</span><p className="font-semibold">{fmtDate(sinistro.data_evento)}</p></div>
        <div><span className="text-muted-foreground">Data denuncia</span><p className="font-semibold">{fmtDate(sinistro.data_denuncia)}</p></div>
        <div><span className="text-muted-foreground">Tipo sinistro</span><p className="font-semibold">{formatTipoSinistro(sinistro)}</p></div>
        <div><span className="text-muted-foreground">N. sinistro compagnia</span><p className="font-semibold">{sinistro.numero_sinistro_compagnia || "—"}</p></div>
        <div><span className="text-muted-foreground">Controparte</span><p className="font-semibold">{sinistro.controparte || "—"}</p></div>
        <div><span className="text-muted-foreground">Targa veicolo</span><p className="font-semibold">{sinistro.targa_veicolo || "—"}</p></div>
      </div>
      {(luogo || luogoExtra) && (
        <div>
          <span className="text-muted-foreground">Luogo</span>
          <p className="font-semibold">{luogo || "—"}</p>
          {luogoExtra && <p className="text-muted-foreground">{luogoExtra}</p>}
        </div>
      )}
      {descrizione && (
        <div>
          <span className="text-muted-foreground">Descrizione</span>
          <p className="mt-1 whitespace-pre-wrap bg-muted/30 p-2.5 rounded border">{descrizione}</p>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div><span className="text-muted-foreground">Riserva</span><p className="font-semibold font-mono">{fmtEuro(sinistro.importo_riserva)}</p></div>
        <div><span className="text-muted-foreground">Costo preventivato</span><p className="font-semibold font-mono">{fmtEuro(sinistro.costo_preventivato)}</p></div>
        <div><span className="text-muted-foreground">Franchigia</span><p className="font-semibold font-mono">{fmtEuro(sinistro.franchigia)}</p></div>
        <div><span className="text-muted-foreground">Liquidato</span><p className="font-semibold font-mono text-emerald-700">{fmtEuro(sinistro.importo_liquidato)}</p></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <span className="text-muted-foreground">Responsabile interno</span>
          <p className="font-semibold">
            {sinistro.profiles ? `${sinistro.profiles.nome || ""} ${sinistro.profiles.cognome || ""}`.trim() : "—"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">Liquidatore esterno</span>
          <p className="font-semibold">
            {sinistro.liquidatore
              ? sinistro.liquidatore.ragione_sociale || `${sinistro.liquidatore.cognome || ""} ${sinistro.liquidatore.nome || ""}`.trim()
              : "—"}
          </p>
        </div>
      </div>
      {sinistro.note_interne && (
        <div>
          <span className="text-muted-foreground">Note interne</span>
          <p className="mt-1 italic text-muted-foreground bg-muted/20 p-2 rounded border">{sinistro.note_interne}</p>
        </div>
      )}
    </div>
  );
}

export default function SinistroDatiPraticaPanel({ sinistro, canEdit, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const isChiuso = sinistro.stato === "chiuso" || sinistro.stato === "respinto";

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<SinistroPraticaValues>({
    resolver: zodResolver(sinistroPraticaSchema),
    defaultValues: sinistroRowToPraticaValues(sinistro as Record<string, unknown>),
  });

  useEffect(() => {
    reset(sinistroRowToPraticaValues(sinistro as Record<string, unknown>));
    setEditing(false);
  }, [sinistro, reset]);

  const { data: responsabiliList = [] } = useQuery({
    queryKey: ["profiles-responsabili-sinistro"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cognome").eq("attivo", true).order("cognome");
      return data || [];
    },
    enabled: editing,
  });

  const { data: liquidatoriList = [] } = useQuery({
    queryKey: ["anagrafiche-liquidatori-sinistro"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anagrafiche_professionali")
        .select("id, nome, cognome, ragione_sociale")
        .eq("tipo", "liquidatore")
        .eq("attivo", true)
        .order("cognome");
      return data || [];
    },
    enabled: editing,
  });

  const onSave = async (values: SinistroPraticaValues) => {
    const tipoErr = validateTipoSinistro(values.tipo_sinistro, values.tipo_sinistro_personalizzato);
    if (tipoErr) {
      toast.error(tipoErr);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("gestione-sinistri", {
        body: {
          azione: "aggiorna",
          sinistro_id: sinistro.id,
          user_id: user?.id,
          ...praticaValuesToDbPayload(values),
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Errore aggiornamento");
      toast.success("Dati pratica aggiornati");
      setEditing(false);
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Errore sconosciuto";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const allowEdit = canEdit && !isChiuso;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">Dati Pratica</CardTitle>
        {allowEdit && !editing && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" /> Modifica
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                reset(sinistroRowToPraticaValues(sinistro as Record<string, unknown>));
                setEditing(false);
              }}
            >
              <X className="h-4 w-4 mr-1" /> Annulla
            </Button>
            <Button type="button" size="sm" disabled={saving} onClick={handleSubmit(onSave)}>
              <Save className="h-4 w-4 mr-1" /> Salva
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isChiuso && !editing && (
          <p className="text-xs text-muted-foreground mb-4">
            Pratica {sinistro.stato}: i dati sono in sola lettura.
          </p>
        )}
        {editing ? (
          <SinistroPraticaFormFields
            register={register}
            setValue={setValue}
            watch={watch}
            errors={errors}
            responsabiliList={responsabiliList}
            liquidatoriList={liquidatoriList}
            showEconomici
            showAssegnazione
            showNoteInterne
          />
        ) : (
          <ReadOnlyGrid sinistro={sinistro} />
        )}
      </CardContent>
    </Card>
  );
}
