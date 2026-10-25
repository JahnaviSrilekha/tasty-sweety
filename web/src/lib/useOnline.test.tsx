// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useOnline } from "./useOnline";

describe("AC-6.3 useOnline", () => {
  it("follows the browser's online and offline events", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);

    onLine.mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(result.current).toBe(false);

    onLine.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event("online")));
    expect(result.current).toBe(true);
  });
});
