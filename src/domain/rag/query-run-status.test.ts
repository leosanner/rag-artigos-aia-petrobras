import { describe, expect, it } from "vitest";

import {
  RAG_QUERY_RUN_ERROR_CODES,
  RAG_QUERY_RUN_STATUSES,
  isFailedRunStatus,
} from "./query-run-status";

describe("RAG_QUERY_RUN_STATUSES", () => {
  it("defines the closed safe persisted run-status catalog", () => {
    expect(RAG_QUERY_RUN_STATUSES).toEqual([
      "answered",
      "answered_no_evidence",
      "generation_failed",
      "generation_unavailable",
    ]);
  });

  it("is frozen so the runtime status catalog cannot be widened by mutation", () => {
    expect(Object.isFrozen(RAG_QUERY_RUN_STATUSES)).toBe(true);
  });
});

describe("RAG_QUERY_RUN_ERROR_CODES", () => {
  it("defines the closed safe persisted error-code catalog", () => {
    expect(RAG_QUERY_RUN_ERROR_CODES).toEqual([
      "generation_failed",
      "generation_unavailable",
    ]);
  });

  it("is frozen so the runtime error-code catalog cannot be widened by mutation", () => {
    expect(Object.isFrozen(RAG_QUERY_RUN_ERROR_CODES)).toBe(true);
  });
});

describe("isFailedRunStatus", () => {
  it("marks only the safe failed statuses as failures", () => {
    expect(isFailedRunStatus("answered")).toBe(false);
    expect(isFailedRunStatus("answered_no_evidence")).toBe(false);
    expect(isFailedRunStatus("generation_failed")).toBe(true);
    expect(isFailedRunStatus("generation_unavailable")).toBe(true);
  });
});
