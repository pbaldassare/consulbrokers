import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { FileText, AlertTriangle, MessageSquare, Car, Building2, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Props {
  canaleId: string;
}

export default function CanaleContextHeader({ canaleId }: Props) {
  const { data } = useQuery({
    queryKey: ["canale_context_info", canaleId],
    queryFn: async () => {
      const { data: canale } = await supabase
        .from("chat_canali")
        .select("entita_tipo, entita_id, nome")
        .eq("id", canaleId)
        .maybeSingle();
      if (!canale) return null;

      if (canale.entita_tipo === "titolo" && canale.entita_id) {
        const { data: t } = await supabase
          .from("titoli")
          .select("numero_titolo, targa_telaio, prodotto_nome, compagnie:compagnia_id(nome), rami:ramo_id(nome)")
          .eq("id", canale.entita_id)
          .maybeSingle();
        return { tipo: "titolo" as const, canale, titolo: t };
      }

      if (canale.entita_tipo === "sinistro" && canale.entita_id) {
        const { data: s } = await supabase
          .from("sinistri")
          .select("numero_sinistro, numero_sinistro_compagnia, tipo_sinistro, stato, data_evento, targa_veicolo, titoli:titolo_id(numero_titolo)")
          .eq("id", canale.entita_id)
          .maybeSingle();
        return { tipo: "sinistro" as const, canale, sinistro: s };
      }

      return { tipo: canale.entita_tipo, canale };
    },
    enabled: !!canaleId,
  });

  if (!data) return null;

  if (data.tipo === "titolo" && data.titolo) {
    const t: any = data.titolo;
    return (
      <div className="border-b border-border bg-primary/5 px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <FileText className="h-4 w-4 text-primary shrink-0" />
        <Badge variant="default" className="font-mono text-[11px]">
          Polizza N° {t.numero_titolo || "—"}
        </Badge>
        {t.targa_telaio && (
          <Badge variant="secondary" className="font-mono text-[11px] gap-1">
            <Car className="h-3 w-3" /> {t.targa_telaio}
          </Badge>
        )}
        {t.compagnie?.nome && (
          <Badge variant="outline" className="text-[11px] gap-1">
            <Building2 className="h-3 w-3" /> {t.compagnie.nome}
          </Badge>
        )}
        {t.rami?.nome && (
          <span className="text-[11px] text-muted-foreground">{t.rami.nome}</span>
        )}
        {t.prodotto_nome && (
          <span className="text-[11px] text-muted-foreground">• {t.prodotto_nome}</span>
        )}
      </div>
    );
  }

  if (data.tipo === "sinistro" && data.sinistro) {
    const s: any = data.sinistro;
    return (
      <div className="border-b border-border bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <Badge variant="default" className="bg-amber-600 hover:bg-amber-700 font-mono text-[11px]">
          Sinistro N° {s.numero_sinistro || "—"}
        </Badge>
        {s.targa_veicolo && (
          <Badge variant="secondary" className="font-mono text-[11px] gap-1">
            <Car className="h-3 w-3" /> {s.targa_veicolo}
          </Badge>
        )}
        {s.tipo_sinistro && (
          <Badge variant="outline" className="text-[11px] capitalize">{s.tipo_sinistro}</Badge>
        )}
        {s.data_evento && (
          <Badge variant="outline" className="text-[11px] gap-1">
            <Calendar className="h-3 w-3" /> {format(new Date(s.data_evento), "dd/MM/yyyy")}
          </Badge>
        )}
        {s.titoli?.numero_titolo && (
          <span className="text-[11px] text-muted-foreground">Polizza {s.titoli.numero_titolo}</span>
        )}
        {s.stato && (
          <Badge variant="outline" className="text-[11px] capitalize ml-auto">{s.stato}</Badge>
        )}
      </div>
    );
  }

  if (data.tipo === "argomento") {
    return (
      <div className="border-b border-border bg-muted/30 px-4 py-2.5 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium text-foreground">{data.canale.nome || "Argomento"}</span>
      </div>
    );
  }

  return null;
}
