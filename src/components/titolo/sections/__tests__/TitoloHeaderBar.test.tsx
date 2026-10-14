import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TitoloHeaderBar } from "../TitoloHeaderBar";

const NOME_LUNGO = "COORDINAMENTO NAZIONALE AEROMODELLISMO LIBERTAS";

describe("TitoloHeaderBar", () => {
  it("mostra la ragione sociale lunga con wrap, senza truncate", () => {
    render(
      <TitoloHeaderBar
        t={{
          id: "468f4e6d-d051-4216-8d4a-61900c367d7d",
          numero_titolo: "110755366",
          stato: "incassato",
          cliente_anagrafica: {
            tipo_cliente: "azienda",
            ragione_sociale: NOME_LUNGO,
          },
        }}
        onBack={vi.fn()}
      />,
    );

    const nome = screen.getByText(NOME_LUNGO);
    expect(nome).toBeInTheDocument();
    expect(nome.className).toMatch(/break-words/);
    expect(nome.className).not.toMatch(/truncate/);
  });
});
