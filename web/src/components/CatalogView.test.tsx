// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithCart } from "@/test/render";
import { CatalogView } from "./CatalogView";

describe("CatalogView", () => {
  it("AC-1.1 lists every sweet", () => {
    renderWithCart(<CatalogView />);
    expect(screen.getAllByRole("article")).toHaveLength(6);
  });

  it("AC-1.4 search narrows the list by name or tag", async () => {
    const user = userEvent.setup();
    renderWithCart(<CatalogView />);
    await user.type(screen.getByRole("searchbox", { name: "Search sweets" }), "SYRUP");
    expect(screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"))).toEqual([
      "Gulab Jamun",
      "Rasgulla",
    ]);
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "pizza");
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.getByText(/No sweets match/)).toBeInTheDocument();
  });
});
