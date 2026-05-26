import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRecentEntities, type EntityKind } from "@/hooks/useRecentEntities";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Match {
  kind: EntityKind;
  id: string;
  path: string;
}

function detect(pathname: string): Match | null {
  const seg = pathname.split("/").filter(Boolean);
  const last = seg[seg.length - 1];
  if (!last || !UUID_RE.test(last)) return null;

  // /archivi/clienti/:id
  if (seg[0] === "archivi" && seg[1] === "clienti") return { kind: "cliente", id: last, path: pathname };
  // /archivi/prospect/:id or /prospect/:id
  if ((seg[0] === "archivi" && seg[1] === "prospect") || seg[0] === "prospect")
    return { kind: "prospect", id: last, path: pathname };
  // /titoli/:id
  if (seg[0] === "titoli") return { kind: "polizza", id: last, path: pathname };
  // /portafoglio/:id  (excluding known sub-routes already handled by absence of UUID)
  if (seg[0] === "portafoglio" && seg.length === 2) return { kind: "polizza", id: last, path: pathname };
  // /sinistri/:id
  if (seg[0] === "sinistri") return { kind: "sinistro", id: last, path: pathname };
  // /trattative/:id
  if (seg[0] === "trattative") return { kind: "trattativa", id: last, path: pathname };
  // /archivi/anagrafiche-agenzie/:id (best effort)
  if (seg[0] === "archivi" && seg[1]?.startsWith("anagrafiche-agenzie"))
    return { kind: "compagnia", id: last, path: pathname };

  return null;
}

async function resolveLabel(m: Match): Promise<{ label: string; sub?: string } | null> {
  try {
    switch (m.kind) {
      case "cliente": {
        const { data } = await supabase
          .from("clienti")
          .select("ragione_sociale, cognome, nome, codice_fiscale, partita_iva")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        const label =
          data.ragione_sociale ||
          [data.cognome, data.nome].filter(Boolean).join(" ") ||
          "Cliente";
        return { label, sub: data.codice_fiscale || data.partita_iva || undefined };
      }
      case "prospect": {
        const { data } = await supabase
          .from("prospect")
          .select("ragione_sociale, cognome, nome, codice_fiscale, partita_iva")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        const label =
          data.ragione_sociale ||
          [data.cognome, data.nome].filter(Boolean).join(" ") ||
          "Prospect";
        return { label, sub: data.codice_fiscale || data.partita_iva || undefined };
      }
      case "polizza": {
        const { data } = await supabase
          .from("titoli")
          .select("numero_titolo, descrizione_polizza, prodotto_nome")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        return {
          label: data.numero_titolo || "Polizza",
          sub: data.descrizione_polizza || data.prodotto_nome || undefined,
        };
      }
      case "sinistro": {
        const { data } = await supabase
          .from("sinistri")
          .select("numero_sinistro, descrizione")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        return { label: data.numero_sinistro || "Sinistro", sub: data.descrizione || undefined };
      }
      case "trattativa": {
        const { data } = await supabase
          .from("trattative")
          .select("prodotto, sottoprodotto, stato")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        return {
          label: data.prodotto || "Trattativa",
          sub: [data.sottoprodotto, data.stato].filter(Boolean).join(" · ") || undefined,
        };
      }
      case "compagnia": {
        const { data } = await supabase
          .from("compagnie")
          .select("nome, codice")
          .eq("id", m.id)
          .maybeSingle();
        if (!data) return null;
        return { label: data.nome || "Compagnia", sub: data.codice || undefined };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/** Mounts no UI. Listens to route changes and pushes entity visits into recent list. */
const RecentEntitiesTracker = () => {
  const { pathname } = useLocation();
  const { addRecent } = useRecentEntities();

  useEffect(() => {
    const m = detect(pathname);
    if (!m) return;
    let cancelled = false;
    (async () => {
      const info = await resolveLabel(m);
      if (cancelled || !info) return;
      addRecent({ kind: m.kind, id: m.id, label: info.label, sub: info.sub, path: m.path });
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, addRecent]);

  return null;
};

export default RecentEntitiesTracker;
