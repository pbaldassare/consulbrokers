import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RegolazioneFattoriImportiGrid } from "../RegolazioneFattoriImportiGrid";

const fattori = [
  { id: "f1", codice: "fatturato", descrizione: "Fatturato" },
  { id: "f2", codice: "num_dipendenti", descrizione: "N° dipendenti" },
  { id: "f3", codice: "superficie", descrizione: "Superficie (mq)" },
  {
    id: "f4",
    codice: "8028",
    descrizione: "Importo delle retribuzioni lorde ai fini INAIL di tutto il personale €",
  },
];

describe("RegolazioneFattoriImportiGrid dialog", () => {
  it("mostra etichette italiane, anno formattato e Seleziona tutto", () => {
    render(
      <RegolazioneFattoriImportiGrid
        ramoId="r1"
        datePresunte={["2027-06-30"]}
        fattori={fattori}
        righe={[]}
        onChange={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /aggiungi fattore/i }));

    expect(screen.getByRole("heading", { name: "Aggiungi fattore" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seleziona tutto" })).toBeVisible();
    expect(screen.getByText("2027 — 30/06/2027")).toBeInTheDocument();
    expect(screen.getByText("Fatturato")).toBeInTheDocument();
    expect(screen.getByText("N° dipendenti")).toBeInTheDocument();
    expect(screen.getByText("Superficie (mq)")).toBeInTheDocument();
    expect(
      screen.getByText(/Importo delle retribuzioni lorde ai fini INAIL/),
    ).toBeInTheDocument();

    expect(screen.queryByText(/\(fatturato\)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/num_dipendenti/)).not.toBeInTheDocument();
    expect(screen.queryByText("2027-06-30")).not.toBeInTheDocument();
    expect(screen.queryByText(/2027 \(2027-06-30\)/)).not.toBeInTheDocument();
  });
});
