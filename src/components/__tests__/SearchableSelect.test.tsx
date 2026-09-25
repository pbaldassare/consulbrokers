import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SearchableSelect,
  searchPopoverContentProps,
  searchableSelectListClass,
} from "@/components/SearchableSelect";
import { FilterSearchableSelect } from "@/components/contabilita/FilterSearchableSelect";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("SearchableSelect unify", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forza il menu sotto il campo senza flip verso l’alto", () => {
    expect(searchPopoverContentProps.side).toBe("bottom");
    expect(searchPopoverContentProps.align).toBe("start");
    expect(searchPopoverContentProps.avoidCollisions).toBe(false);
    expect(searchPopoverContentProps.sideOffset).toBe(8);
    expect(searchableSelectListClass).toContain("max-h-[20rem]");
  });

  it("apre le opzioni sotto il trigger con spacing uniforme", async () => {
    render(
      <SearchableSelect
        options={[
          { value: "1", label: "Rossi Mario", description: "Via Roma 1, Milano" },
          { value: "2", label: "Bianchi Anna" },
        ]}
        value=""
        onValueChange={() => {}}
        placeholder="Cliente"
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByText("Rossi Mario")).toBeInTheDocument();
    expect(screen.getByText("Via Roma 1, Milano")).toBeInTheDocument();

    const list = document.querySelector("[cmdk-list]");
    expect(list).toHaveClass("max-h-[20rem]");
  });

  it("FilterSearchableSelect riusa SearchableSelect con clearable", async () => {
    render(
      <FilterSearchableSelect
        value={null}
        onValueChange={() => {}}
        options={[{ value: "u1", label: "Milano" }]}
        placeholder="Sede"
        allLabel="Tutte le sedi"
      />,
    );

    fireEvent.click(screen.getByRole("combobox"));
    expect(await screen.findByText("Milano")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cerca sede...")).toBeInTheDocument();
  });
});
