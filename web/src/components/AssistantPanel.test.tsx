// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithCart } from "@/test/render";
import { assistantEvents, sseResponse } from "@/test/sse";
import { AssistantPanel } from "./AssistantPanel";

describe("AssistantPanel", () => {
  it("AC-3.1 AC-3.5 streams the reply, shows the proposal, and only changes the cart on Add", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse(assistantEvents("Two large Kaju Katli and a Gulab Jamun!"))));
    const user = userEvent.setup();
    const { cart } = renderWithCart(<AssistantPanel />);

    await user.type(screen.getByRole("textbox", { name: "What would you like to order?" }), "2 large kaju katli, jamun");
    await user.click(screen.getByRole("button", { name: "Ask" }));

    expect(await screen.findByText("Two large Kaju Katli and a Gulab Jamun!")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-total")).toHaveTextContent("₹2,700");
    expect(cart().lines).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(cart().lines).toEqual([
      { sweetId: "kaju-katli", size: "large", qty: 2 },
      { sweetId: "gulab-jamun", size: "medium", qty: 1 },
    ]);
    expect(screen.queryByTestId("proposal-total")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/added 3 boxes/i);
  });

  it("shows the assistant's error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => sseResponse([
      { type: "RUN_STARTED", threadId: "t", runId: "r" },
      { type: "RUN_ERROR", message: "Please type what you would like to order.", code: "no_message" },
    ])));
    const user = userEvent.setup();
    renderWithCart(<AssistantPanel />);
    await user.type(screen.getByRole("textbox"), "x");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please type what you would like to order.");
  });

  it("AC-6.4 is disabled offline and says why", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderWithCart(<AssistantPanel />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    expect(screen.getByText(/needs an internet connection/i)).toBeInTheDocument();
  });

  it("does not send an empty message", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWithCart(<AssistantPanel />);
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
