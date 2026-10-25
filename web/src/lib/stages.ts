// Order stages (spec 001, REQ-5). Must match TRANSITIONS in api/app/orders.py;
// the server is the one that enforces it.
export type Stage = "placed" | "confirmed" | "ready" | "completed" | "cancelled";

export const STAGES: readonly Stage[] = ["placed", "confirmed", "ready", "completed", "cancelled"];

export const NEXT_STAGES: Record<Stage, Stage[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["ready", "cancelled"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
};

export const STAGE_LABELS: Record<Stage, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** The happy path shown as steps on the order page. */
export const PROGRESS: readonly Stage[] = ["placed", "confirmed", "ready", "completed"];
