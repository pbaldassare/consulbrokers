import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DistintaRestituzioneAnteprima } from "@/components/estrazioni/DistintaRestituzioneAnteprima";
import { buildDistintaRestituzioneModel } from "@/lib/restituzioneOriginali";

describe("DistintaRestituzioneAnteprima", () => {
  it("mostra protocollo, destinatario, note e tabella", () => {
    const model = buildDistintaRestituzioneModel(
      {
        key: "g1",
        compagniaId: "ag1",
        compagniaNome: "Generali",
        rows: [
          {
            documentoId: "d1",
            nomeFile: "polizza.pdf",
            createdAt: "2026-01-15",
            titoloId: "t1",
            numeroTitolo: "204366651",
            tipoTitolo: "polizza",
            clienteId: "c1",
            clienteNome: "Rossi Mario",
            compagniaId: "ag1",
            compagniaNome: "Generali",
            inviato: false,
          },
        ],
      },
      new Date(2026, 8, 25),
      { note: "Raccomandata A/R", clientiLabel: "Rossi Mario" },
    );
    render(<DistintaRestituzioneAnteprima model={model} />);
    expect(screen.getByTestId("distinta-anteprima")).toBeInTheDocument();
    expect(screen.getByText(/Distinta di restituzione originali/)).toBeInTheDocument();
    expect(screen.getByText("Generali")).toBeInTheDocument();
    expect(screen.getByText("Raccomandata A/R")).toBeInTheDocument();
    expect(screen.getByText("204366651")).toBeInTheDocument();
    expect(screen.getByText("polizza.pdf")).toBeInTheDocument();
  });
});
