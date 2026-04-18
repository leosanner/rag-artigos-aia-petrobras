export type DocumentStatus = "pending" | "processed" | "failed";

const TRANSITIONS: Record<DocumentStatus, ReadonlyArray<DocumentStatus>> = {
  pending: ["processed", "failed"],
  processed: [],
  failed: [],
};

export class InvalidStatusTransitionError extends Error {
  readonly from: DocumentStatus;
  readonly to: DocumentStatus;

  constructor(from: DocumentStatus, to: DocumentStatus) {
    super(`Invalid document status transition: ${from} -> ${to}`);
    this.name = "InvalidStatusTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function canTransition(
  from: DocumentStatus,
  to: DocumentStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionStatus(
  from: DocumentStatus,
  to: DocumentStatus,
): DocumentStatus {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
  return to;
}
