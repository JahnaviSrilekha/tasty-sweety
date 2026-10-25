// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Proposal } from "@/lib/agui";
import { PROPOSAL } from "@/test/sse";
import { ProposalCard } from "./ProposalCard";

const proposal = PROPOSAL as Proposal;

function setup() {
  const onAdd = vi.fn();
  const onDismiss = vi.fn();
  render(<ProposalCard proposal={proposal} onAdd={onAdd} onDismiss={onDismiss} />);
  return { onAdd, onDismiss, user: userEvent.setup() };
}

describe("ProposalCard", () => {
  it("AC-3.5 shows the proposed lines with prices and the total", () => {
    setup();
    expect(screen.getByText("Kaju Katli")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-total")).toHaveTextContent("₹2,700");
  });

  it("AC-3.4 marks a size that was assumed", () => {
    setup();
    expect(screen.getByText(/size assumed/i)).toBeInTheDocument();
  });

  it("AC-3.3 lists what could not be added and why", () => {
    setup();
    expect(screen.getByText(/jalebi/)).toBeInTheDocument();
    expect(screen.getByText(/not in our shop/i)).toBeInTheDocument();
  });

  it("AC-3.5 the customer can remove a line before adding", async () => {
    const { onAdd, user } = setup();
    await user.click(screen.getByRole("button", { name: "Remove Gulab Jamun Medium from suggestion" }));
    expect(screen.getByTestId("proposal-total")).toHaveTextContent("₹2,400");
    await user.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(onAdd).toHaveBeenCalledWith([{ sweetId: "kaju-katli", size: "large", qty: 2 }]);
  });

  it("AC-3.5 dismiss adds nothing", async () => {
    const { onAdd, onDismiss, user } = setup();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("Add to cart is disabled once every line is removed", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Remove Kaju Katli Large from suggestion" }));
    await user.click(screen.getByRole("button", { name: "Remove Gulab Jamun Medium from suggestion" }));
    expect(screen.getByRole("button", { name: "Add to cart" })).toBeDisabled();
  });
});
