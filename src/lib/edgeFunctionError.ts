type EdgeErrorBody = {
  success?: boolean;
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[]>;
    formErrors?: string[];
  };
};

/** Estrae un messaggio utile da invoke edge function ( anche su 4xx/5xx ). */
export function formatEdgeFunctionError(
  error: { message?: string } | null | undefined,
  data: EdgeErrorBody | null | undefined,
): string {
  if (data?.error) return data.error;

  const fieldErrors = data?.details?.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (Array.isArray(messages) && messages[0]) {
        return `${field}: ${messages[0]}`;
      }
    }
  }

  const formErrors = data?.details?.formErrors;
  if (Array.isArray(formErrors) && formErrors[0]) {
    return formErrors[0];
  }

  if (data?.details) return "Payload non valido per il server";

  const generic = error?.message || "";
  if (generic.includes("non-2xx")) {
    return "Errore del server durante l'operazione. Riprova o contatta l'assistenza.";
  }

  return generic || "Errore sconosciuto";
}
