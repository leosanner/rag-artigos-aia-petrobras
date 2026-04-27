import { describe, expect, it } from "vitest";

import {
  SelectableRagDocumentSchema,
  type SelectableRagDocument,
} from "./selectable-document";

const buildSelectable = (
  overrides: Partial<SelectableRagDocument> = {},
): SelectableRagDocument => ({
  id: "11111111-1111-4111-8111-111111111111",
  title: "Remote sensing for EIA",
  authors: null,
  publicationYear: null,
  doi: null,
  chunkCount: 12,
  updatedAt: "2026-04-27T10:00:00.000Z",
  ...overrides,
});

describe("SelectableRagDocumentSchema", () => {
  it("accepts a payload with all bibliographic fields populated", () => {
    const result = SelectableRagDocumentSchema.safeParse(
      buildSelectable({
        authors: "Doe, J.; Roe, J.",
        publicationYear: 2021,
        doi: "10.1234/abcd.5678",
      }),
    );

    expect(result.success).toBe(true);
  });

  it("accepts null for every optional bibliographic field", () => {
    const result = SelectableRagDocumentSchema.safeParse(buildSelectable());

    expect(result.success).toBe(true);
  });

  it("rejects undefined for bibliographic fields (must be explicit null)", () => {
    const partial: Record<string, unknown> = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Remote sensing for EIA",
      chunkCount: 12,
      updatedAt: "2026-04-27T10:00:00.000Z",
    };

    const result = SelectableRagDocumentSchema.safeParse(partial);

    expect(result.success).toBe(false);
  });

  it("requires a non-empty title", () => {
    const result = SelectableRagDocumentSchema.safeParse(
      buildSelectable({ title: "" }),
    );

    expect(result.success).toBe(false);
  });

  it("requires id to be a UUID", () => {
    const result = SelectableRagDocumentSchema.safeParse(
      buildSelectable({ id: "not-a-uuid" }),
    );

    expect(result.success).toBe(false);
  });

  it("requires chunkCount to be a non-negative integer", () => {
    expect(
      SelectableRagDocumentSchema.safeParse(
        buildSelectable({ chunkCount: -1 }),
      ).success,
    ).toBe(false);

    expect(
      SelectableRagDocumentSchema.safeParse(
        buildSelectable({ chunkCount: 1.5 }),
      ).success,
    ).toBe(false);

    expect(
      SelectableRagDocumentSchema.safeParse(buildSelectable({ chunkCount: 0 }))
        .success,
    ).toBe(true);
  });

  it("requires updatedAt to be an ISO 8601 datetime string", () => {
    const result = SelectableRagDocumentSchema.safeParse(
      buildSelectable({ updatedAt: "yesterday" }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields", () => {
    const result = SelectableRagDocumentSchema.safeParse({
      ...buildSelectable(),
      extra: true,
    });

    expect(result.success).toBe(false);
  });

  it("constrains publicationYear to a positive integer when provided", () => {
    expect(
      SelectableRagDocumentSchema.safeParse(
        buildSelectable({ publicationYear: 1.5 }),
      ).success,
    ).toBe(false);

    expect(
      SelectableRagDocumentSchema.safeParse(
        buildSelectable({ publicationYear: 0 }),
      ).success,
    ).toBe(false);

    expect(
      SelectableRagDocumentSchema.safeParse(
        buildSelectable({ publicationYear: 2026 }),
      ).success,
    ).toBe(true);
  });
});
