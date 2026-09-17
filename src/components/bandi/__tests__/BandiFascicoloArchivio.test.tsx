import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BandiFascicoloArchivio } from "@/components/bandi/BandiFascicoloArchivio";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) },
    from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }),
  },
}));

describe("BandiFascicoloArchivio", () => {
  it("mette Aggiorna bando nel dialogo, separato dallo scarico PDF", () => {
    const onAggiornaBando = vi.fn();
    const onScaricaTutti = vi.fn();
    render(
      <BandiFascicoloArchivio
        open
        onOpenChange={() => {}}
        bando={{ id: "b1", ente: "Comune di Varese", titolo: "Brokeraggio" }}
        documenti={[]}
        onScaricaTutti={onScaricaTutti}
        onAggiornaBando={onAggiornaBando}
        onRefresh={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Aggiorna bando dal portale" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scarica dal portale" })).toBeInTheDocument();
    expect(screen.getByText(/cerca nuovi dati sulla scheda/i)).toBeInTheDocument();
    expect(screen.getByText("Ultimo aggiornamento dal portale")).toBeInTheDocument();
    expect(screen.getByText("Ultimo scarico dal portale")).toBeInTheDocument();
    expect(screen.getAllByText("Mai")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Aggiorna bando dal portale" }));
    expect(onAggiornaBando).toHaveBeenCalledTimes(1);
    expect(onScaricaTutti).not.toHaveBeenCalled();
  });

  it("evidenzia le date di aggiornamento scheda e scarico documenti", () => {
    const aggiornamento = new Date(2026, 8, 16, 10, 1).toISOString();
    const scarico = new Date(2026, 8, 15, 9, 5).toISOString();
    render(
      <BandiFascicoloArchivio
        open
        onOpenChange={() => {}}
        bando={{ id: "b1", ente: "Comune di Varese", titolo: "Brokeraggio" }}
        documenti={[{
          id: "d1",
          bando_id: "b1",
          tipo: "bando",
          nome: "Avviso.pdf",
          mime: "application/pdf",
          url_origine: "https://x/a.pdf",
          storage_path: "x/a.pdf",
          hash_sha256: null,
          stato: "invariato",
          visto_il: null,
          scaricato_il: scarico,
          harvest_run_id: "run-doc",
        }]}
        harvestRuns={[
          {
            id: "run-scheda",
            bando_id: "b1",
            avviato_il: aggiornamento,
            concluso_il: aggiornamento,
            esito: "ok",
            motore: "ted",
            documenti_nuovi: 0,
            documenti_aggiornati: 0,
            novita_json: { azione: "scheda" },
            errore: null,
          },
        ]}
        harvestAt={aggiornamento}
        onRefresh={() => {}}
      />,
    );

    expect(screen.getByText("16/09/2026 10:01")).toBeInTheDocument();
    expect(screen.getByText("15/09/2026 09:05")).toBeInTheDocument();
  });
});
