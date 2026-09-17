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

    fireEvent.click(screen.getByRole("button", { name: "Aggiorna bando dal portale" }));
    expect(onAggiornaBando).toHaveBeenCalledTimes(1);
    expect(onScaricaTutti).not.toHaveBeenCalled();
  });
});
