// Classi di merito CU (Conversione Universale) 1-18
export const CLASSI_MERITO = Array.from({ length: 18 }, (_, i) => ({
  value: String(i + 1),
  label: `Classe ${i + 1}`,
}));

// Tipi veicolo standard
export const TIPI_VEICOLO = [
  "AUTOVETTURA",
  "AUTOTASSAMETRO",
  "AUTOBUS",
  "AUTOCARRO",
  "CICLOMOTORE",
  "MOTOCICLO",
  "MACCHINA OPERATRICE",
  "MACCHINA AGRICOLA",
  "NATANTE",
  "RIMORCHIO",
  "CARRELLO",
  "AUTOARTICOLATO",
  "CAMPER",
  "QUADRICICLO",
].map((v) => ({ value: v, label: v }));
