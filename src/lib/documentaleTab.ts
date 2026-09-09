export const DOCUMENTALE_TABS = ["archivio", "libreria-cga", "assistente-garanzie"] as const;
export type DocumentaleTab = (typeof DOCUMENTALE_TABS)[number];

/** Query `tab=cb-bot` (sidebar) → tab interno `assistente-garanzie`. */
export function parseDocumentaleTab(raw: string | null, consultazioneMode: boolean): DocumentaleTab {
  if (raw === "cb-bot" || raw === "assistente-garanzie") return "assistente-garanzie";
  if (raw === "libreria-cga") return "libreria-cga";
  if (raw === "archivio") return "archivio";
  return consultazioneMode ? "assistente-garanzie" : "archivio";
}

export function documentaleTabToQuery(tab: DocumentaleTab, consultazioneMode: boolean): string | null {
  if (tab === "assistente-garanzie") return "cb-bot";
  if (tab === "archivio" && !consultazioneMode) return null;
  return tab;
}
