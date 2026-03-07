export type DevicePollOutcome =
  | { kind: "authorized" }
  | { kind: "pending" }
  | { kind: "expired" }
  | { kind: "denied" }
  | { kind: "error"; message: string };

export function resolveDevicePollOutcome(
  status?: string,
  error?: string,
): DevicePollOutcome {
  switch (status) {
    case "authorized":
      return { kind: "authorized" };
    case "pending":
      return { kind: "pending" };
    case "expired":
      return { kind: "expired" };
    case "denied":
      return { kind: "denied" };
    default:
      return { kind: "error", message: error ?? "Unknown error from poll" };
  }
}
