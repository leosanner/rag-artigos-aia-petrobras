import { describe, expect, it } from "vitest";

import {
  canTransition,
  type DocumentStatus,
  InvalidStatusTransitionError,
  transitionStatus,
} from "./status";

const ALL_STATUSES: ReadonlyArray<DocumentStatus> = [
  "pending",
  "processed",
  "failed",
];

const VALID_TRANSITIONS: ReadonlyArray<readonly [DocumentStatus, DocumentStatus]> = [
  ["pending", "processed"],
  ["pending", "failed"],
];

function isValid(from: DocumentStatus, to: DocumentStatus): boolean {
  return VALID_TRANSITIONS.some(([f, t]) => f === from && t === to);
}

describe("transitionStatus", () => {
  for (const [from, to] of VALID_TRANSITIONS) {
    it(`allows ${from} -> ${to}`, () => {
      expect(transitionStatus(from, to)).toBe(to);
    });
  }

  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      if (isValid(from, to)) continue;
      it(`rejects ${from} -> ${to}`, () => {
        expect(() => transitionStatus(from, to)).toThrow(
          InvalidStatusTransitionError,
        );
      });
    }
  }

  it("rejects self-transitions", () => {
    for (const status of ALL_STATUSES) {
      expect(() => transitionStatus(status, status)).toThrow(
        InvalidStatusTransitionError,
      );
    }
  });

  it("rejects any transition leaving a terminal state", () => {
    for (const terminal of ["processed", "failed"] as const) {
      for (const target of ALL_STATUSES) {
        expect(() => transitionStatus(terminal, target)).toThrow(
          InvalidStatusTransitionError,
        );
      }
    }
  });
});

describe("canTransition", () => {
  it("returns true for every allowed transition and false otherwise", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        expect(canTransition(from, to)).toBe(isValid(from, to));
      }
    }
  });

  it("never throws", () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        expect(() => canTransition(from, to)).not.toThrow();
      }
    }
  });
});

describe("InvalidStatusTransitionError", () => {
  it("is an Error instance", () => {
    const error = new InvalidStatusTransitionError("processed", "pending");

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(InvalidStatusTransitionError);
    expect(error.name).toBe("InvalidStatusTransitionError");
  });

  it("preserves the from and to states so callers can diagnose the bug", () => {
    try {
      transitionStatus("processed", "pending");
      expect.unreachable("transitionStatus should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidStatusTransitionError);
      const typed = err as InvalidStatusTransitionError;
      expect(typed.from).toBe("processed");
      expect(typed.to).toBe("pending");
    }
  });
});
