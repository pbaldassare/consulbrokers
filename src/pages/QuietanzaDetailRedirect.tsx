import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

/** Alias `/quietanze/:id` → unica vista staff `TitoloDetail` (`/titoli/:id`). */
export default function QuietanzaDetailRedirect() {
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
      const { data, error } = await supabase
        .from("quietanze")
        .select("titolo_id")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data?.titolo_id) {
        setNotFound(true);
        return;
      }
      setTitoloId(data.titolo_id);
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
      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Apertura quietanza…
    </div>
  );
}
