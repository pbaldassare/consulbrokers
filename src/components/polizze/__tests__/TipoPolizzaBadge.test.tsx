import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TipoPolizzaBadge } from "@/components/polizze/TipoPolizzaBadge";

describe("TipoPolizzaBadge", () => {
  it.each([
    ["polizza", "Polizza"],
    ["quietanza", "Quietanza"],
    ["appendice", "Appendice"],
  ] as const)("mostra Incassata accanto al tipo %s messo a cassa", (tipo, label) => {
    render(<TipoPolizzaBadge tipo={tipo} messaACassa />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("Incassata")).toBeInTheDocument();
  });

  it("non mostra Incassata per un titolo aperto", () => {
    render(<TipoPolizzaBadge tipo="polizza" />);

    expect(screen.queryByText("Incassata")).not.toBeInTheDocument();
  });
});
