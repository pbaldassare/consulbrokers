import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/** Alias `/polizze/:id` → unica vista staff `TitoloDetail` (`/titoli/:id`). */
export default function PolizzaDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  const [titoloId, setTitoloId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      if (!id) {
        setNotFound(true);
        return;
      }
      const { data: titoloDirect } = await supabase.from("titoli").select("id").eq("id", id).maybeSingle();
      if (cancelled) return;
      if (titoloDirect?.id) {
        setTitoloId(titoloDirect.id);
        return;
      }
      const { data: polizzaRow } = await supabase
        .from("polizze")
        .select("titolo_madre_id")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (polizzaRow?.titolo_madre_id) {
        setTitoloId(polizzaRow.titolo_madre_id);
        return;
      }
      const { data, error } = await supabase
        .from("titoli")
        .select("id, sostituisce_polizza, created_at")
        .eq("polizza_id", id)
        .order("created_at", { ascending: true })
        .limit(50);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setNotFound(true);
        return;
      }
      const madre = data.find((t: any) => !t.sostituisce_polizza) ?? data[0];
      setTitoloId(madre.id);
    }
    resolve();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (notFound) return <Navigate to="/portafoglio/attive" replace />;
  if (titoloId) return <Navigate to={`/titoli/${titoloId}`} replace />;
  return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Apertura polizza…
    </div>
  );
}
