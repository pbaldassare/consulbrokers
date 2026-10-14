import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SinistriReportGrafico } from "../SinistriReportGrafico";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  CartesianGrid: () => null,
  Cell: () => null,
}));

const rows = [
  {
    numero_sinistro: "S-1",
    stato: "aperto",
    tipo_sinistro: "furto",
    data_evento: "2026-03-01",
    citta_sinistro: "Varese",
    luogo_sinistro: "Biumo",
    importo_riserva: 100,
    compagnie: { nome: "Generali" },
  },
];

describe("SinistriReportGrafico", () => {
  it("mostra KPI, zona e pulsante Excel", () => {
    const onExport = vi.fn();
    render(
      <SinistriReportGrafico
        rows={rows}
        onExport={onExport}
        eventoDa=""
        eventoA=""
        onEventoDa={() => {}}
        onEventoA={() => {}}
        compagniaId="tutti"
        compagnie={[]}
        onCompagnia={() => {}}
        responsabileId="tutti"
        responsabili={[]}
        onResponsabile={() => {}}
      />,
    );

    expect(screen.getByText("Sinistri per zona")).toBeInTheDocument();
    expect(screen.getByText("Frequenza mensile")).toBeInTheDocument();
    expect(screen.getByText("Biumo — Varese")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Genera Excel/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Genera Excel/i }));
    expect(onExport).toHaveBeenCalled();
  });
});
