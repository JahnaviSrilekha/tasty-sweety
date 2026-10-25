// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { catalog, type Sweet } from "@/lib/catalog";
import { renderWithCart } from "@/test/render";
import { SweetCard } from "./SweetCard";

const kaju = catalog.sweets[0];

describe("SweetCard", () => {
  it("AC-1.1 AC-1.2 shows the name, description and every size with weight and price", () => {
    renderWithCart(<SweetCard sweet={kaju} />);
    expect(screen.getByRole("heading", { name: "Kaju Katli" })).toBeInTheDocument();
    expect(screen.getByText(kaju.description)).toBeInTheDocument();
    const sizes = within(screen.getByRole("radiogroup", { name: "Box size for Kaju Katli" }));
    expect(sizes.getByRole("radio", { name: /Small.*250 g.*₹320/ })).toBeInTheDocument();
    expect(sizes.getByRole("radio", { name: /Medium.*500 g.*₹620/ })).toBeChecked();
    expect(sizes.getByRole("radio", { name: /Large.*1 kg.*₹1,200/ })).toBeInTheDocument();
  });

  it("AC-2.1 adds the chosen size, and adds one more on a second tap", async () => {
    const user = userEvent.setup();
    const { cart } = renderWithCart(<SweetCard sweet={kaju} />);
    await user.click(screen.getByRole("radio", { name: /Large/ }));
    await user.click(screen.getByRole("button", { name: "Add Kaju Katli to cart" }));
    await user.click(screen.getByRole("button", { name: "Add Kaju Katli to cart" }));
    expect(cart()).toEqual({ lines: [{ sweetId: "kaju-katli", size: "large", qty: 2 }] });
    expect(screen.getByRole("status")).toHaveTextContent(/added/i);
  });

  it("AC-1.3 an unavailable sweet is greyed out and cannot be added", () => {
    const closed: Sweet = { ...kaju, available: false };
    renderWithCart(<SweetCard sweet={closed} />);
    expect(screen.getByRole("button", { name: /Kaju Katli/ })).toBeDisabled();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveAttribute("data-available", "false");
    expect(screen.getByRole("article").className).toMatch(/grayscale/);
  });

  it("AC-6.1 the add button is at least 44px tall", () => {
    renderWithCart(<SweetCard sweet={kaju} />);
    expect(screen.getByRole("button", { name: "Add Kaju Katli to cart" }).className).toMatch(/min-h-11/);
  });
});
