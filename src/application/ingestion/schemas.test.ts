import { describe, expect, it } from "vitest";

import {
  ingestionRunDetailResponseSchema,
  ingestionRunInvalidIdResponseSchema,
  ingestionRunItemResponseSchema,
  ingestionRunNotFoundResponseSchema,
  ingestionSyncConflictResponseSchema,
  ingestionSyncQueuedResponseSchema,
  ingestionSyncUnauthorizedResponseSchema,
} from "./schemas";

const RUN_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ITEM_UUID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DOC_UUID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const LEAK_MARKERS = [
  "postgres://",
  "INGESTION_SYNC_SECRET",
  "BEGIN PRIVATE KEY",
  "GOOGLE_SERVICE_ACCOUNT",
  "INNGEST_SIGNING_KEY",
];

function assertNoLeak(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const marker of LEAK_MARKERS) {
    expect(serialized).not.toContain(marker);
  }
  expect(serialized).not.toMatch(/\s+at\s.+:\d+:\d+/);
}

describe("ingestionSyncQueuedResponseSchema", () => {
  it("accepts a queued response with uuid, status queued, and positive maxDocuments", () => {
    const parsed = ingestionSyncQueuedResponseSchema.parse({
      runId: RUN_UUID,
      status: "queued",
      maxDocuments: 3,
    });

    expect(parsed).toEqual({
      runId: RUN_UUID,
      status: "queued",
      maxDocuments: 3,
    });
  });

  it("rejects non-uuid runId", () => {
    expect(() =>
      ingestionSyncQueuedResponseSchema.parse({
        runId: "not-a-uuid",
        status: "queued",
        maxDocuments: 3,
      }),
    ).toThrow();
  });

  it("rejects non-queued status to keep the wire format precise", () => {
    expect(() =>
      ingestionSyncQueuedResponseSchema.parse({
        runId: RUN_UUID,
        status: "processing",
        maxDocuments: 3,
      }),
    ).toThrow();
  });

  it("rejects zero or negative maxDocuments", () => {
    expect(() =>
      ingestionSyncQueuedResponseSchema.parse({
        runId: RUN_UUID,
        status: "queued",
        maxDocuments: 0,
      }),
    ).toThrow();
  });

  it("strips unknown fields so secrets cannot hitch-hike", () => {
    const parsed = ingestionSyncQueuedResponseSchema.parse({
      runId: RUN_UUID,
      status: "queued",
      maxDocuments: 3,
      INGESTION_SYNC_SECRET: "leaked-secret",
    });

    expect(parsed).not.toHaveProperty("INGESTION_SYNC_SECRET");
    assertNoLeak(parsed);
  });
});

describe("ingestionSyncConflictResponseSchema", () => {
  it("accepts a conflict with an active run id", () => {
    const parsed = ingestionSyncConflictResponseSchema.parse({
      activeRunId: RUN_UUID,
    });

    expect(parsed).toEqual({ activeRunId: RUN_UUID });
  });

  it("accepts a conflict when the active run id is unknown (null)", () => {
    const parsed = ingestionSyncConflictResponseSchema.parse({
      activeRunId: null,
    });

    expect(parsed).toEqual({ activeRunId: null });
  });
});

describe("ingestionSyncUnauthorizedResponseSchema", () => {
  it("accepts exactly { error: 'unauthorized' }", () => {
    const parsed = ingestionSyncUnauthorizedResponseSchema.parse({
      error: "unauthorized",
    });

    expect(parsed).toEqual({ error: "unauthorized" });
  });

  it("rejects any other error label", () => {
    expect(() =>
      ingestionSyncUnauthorizedResponseSchema.parse({ error: "forbidden" }),
    ).toThrow();
  });
});

describe("ingestionRunInvalidIdResponseSchema", () => {
  it("accepts exactly { error: 'invalid_id' }", () => {
    const parsed = ingestionRunInvalidIdResponseSchema.parse({
      error: "invalid_id",
    });

    expect(parsed).toEqual({ error: "invalid_id" });
  });

  it("rejects any other error label", () => {
    expect(() =>
      ingestionRunInvalidIdResponseSchema.parse({ error: "not_found" }),
    ).toThrow();
  });
});

describe("ingestionRunNotFoundResponseSchema", () => {
  it("accepts exactly { error: 'not_found' }", () => {
    const parsed = ingestionRunNotFoundResponseSchema.parse({
      error: "not_found",
    });

    expect(parsed).toEqual({ error: "not_found" });
  });

  it("rejects any other error label", () => {
    expect(() =>
      ingestionRunNotFoundResponseSchema.parse({ error: "invalid_id" }),
    ).toThrow();
  });
});

describe("ingestionRunItemResponseSchema", () => {
  it("accepts a processed item with a document id", () => {
    const parsed = ingestionRunItemResponseSchema.parse({
      id: ITEM_UUID,
      driveFileId: "drive-file-1",
      title: "example.pdf",
      status: "processed",
      lastError: null,
      documentId: DOC_UUID,
    });

    expect(parsed.status).toBe("processed");
    expect(parsed.documentId).toBe(DOC_UUID);
  });

  it("accepts a failed item without a document id and with an error code", () => {
    const parsed = ingestionRunItemResponseSchema.parse({
      id: ITEM_UUID,
      driveFileId: "drive-file-1",
      title: "example.pdf",
      status: "failed",
      lastError: "drive_download_failed",
      documentId: null,
    });

    expect(parsed.lastError).toBe("drive_download_failed");
  });

  it("rejects an unknown error code", () => {
    expect(() =>
      ingestionRunItemResponseSchema.parse({
        id: ITEM_UUID,
        driveFileId: "drive-file-1",
        title: "example.pdf",
        status: "failed",
        lastError: "not_a_real_code",
        documentId: null,
      }),
    ).toThrow();
  });
});

describe("ingestionRunDetailResponseSchema", () => {
  const validDetail = {
    id: RUN_UUID,
    status: "processing" as const,
    maxDocuments: 3,
    selectedCount: 2,
    processedCount: 1,
    failedCount: 0,
    skippedExistingCount: 1,
    lastError: null,
    items: [
      {
        id: ITEM_UUID,
        driveFileId: "drive-file-1",
        title: "example.pdf",
        status: "processed" as const,
        lastError: null,
        documentId: DOC_UUID,
      },
    ],
  };

  it("accepts a well-formed run detail response", () => {
    const parsed = ingestionRunDetailResponseSchema.parse(validDetail);
    expect(parsed).toEqual(validDetail);
  });

  it("rejects negative counts", () => {
    expect(() =>
      ingestionRunDetailResponseSchema.parse({
        ...validDetail,
        selectedCount: -1,
      }),
    ).toThrow();
  });

  it("rejects run status values outside the enum", () => {
    expect(() =>
      ingestionRunDetailResponseSchema.parse({
        ...validDetail,
        status: "cancelled",
      }),
    ).toThrow();
  });

  it("strips unknown fields so secrets cannot hitch-hike", () => {
    const parsed = ingestionRunDetailResponseSchema.parse({
      ...validDetail,
      DATABASE_URL: "postgres://user:secret@host/db",
      INGESTION_SYNC_SECRET: "leaked-secret",
    });

    assertNoLeak(parsed);
  });

  it("no-leak regression across serialized parsed fixtures", () => {
    const parsedQueued = ingestionSyncQueuedResponseSchema.parse({
      runId: RUN_UUID,
      status: "queued",
      maxDocuments: 3,
    });
    const parsedConflict = ingestionSyncConflictResponseSchema.parse({
      activeRunId: RUN_UUID,
    });
    const parsedUnauthorized = ingestionSyncUnauthorizedResponseSchema.parse({
      error: "unauthorized",
    });
    const parsedInvalidId = ingestionRunInvalidIdResponseSchema.parse({
      error: "invalid_id",
    });
    const parsedNotFound = ingestionRunNotFoundResponseSchema.parse({
      error: "not_found",
    });
    const parsedDetail = ingestionRunDetailResponseSchema.parse(validDetail);

    assertNoLeak(parsedQueued);
    assertNoLeak(parsedConflict);
    assertNoLeak(parsedUnauthorized);
    assertNoLeak(parsedInvalidId);
    assertNoLeak(parsedNotFound);
    assertNoLeak(parsedDetail);
  });
});
