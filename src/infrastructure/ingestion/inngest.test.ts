import { describe, expect, it, vi } from "vitest";

import {
  INGESTION_SYNC_REQUESTED_EVENT,
  InngestIngestionEventPublisher,
  createProcessIngestionRunFunction,
  ingestionSyncRequestedEventDataSchema,
} from "./inngest";

const runId = "00000000-0000-4000-8000-000000000001";

describe("Inngest ingestion infrastructure", () => {
  it("validates the sync-requested event data", () => {
    expect(ingestionSyncRequestedEventDataSchema.parse({ runId })).toEqual({
      runId,
    });
    expect(() =>
      ingestionSyncRequestedEventDataSchema.parse({ runId: "not-a-uuid" }),
    ).toThrow();
  });

  it("publishes the exact ingestion sync requested payload", async () => {
    const client = {
      send: vi.fn().mockResolvedValue(undefined),
    };
    const publisher = new InngestIngestionEventPublisher(client);

    await publisher.publishSyncRequested(runId);

    expect(client.send).toHaveBeenCalledWith({
      name: INGESTION_SYNC_REQUESTED_EVENT,
      data: { runId },
    });
  });

  it("registers an Inngest function that validates event data before calling the handler", async () => {
    const handler = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    const client = {
      createFunction: vi.fn((_options, registeredHandler) => registeredHandler),
    };

    const registeredHandler = createProcessIngestionRunFunction(handler, client);

    expect(client.createFunction).toHaveBeenCalledWith(
      {
        id: "process-ingestion-run",
        name: "Process ingestion run",
        triggers: { event: INGESTION_SYNC_REQUESTED_EVENT },
      },
      expect.any(Function),
    );
    await registeredHandler({ event: { data: { runId } } });

    expect(handler.execute).toHaveBeenCalledWith(runId);
  });

  it("does not call the handler when Inngest event data is invalid", async () => {
    const handler = {
      execute: vi.fn().mockResolvedValue(undefined),
    };
    const client = {
      createFunction: vi.fn((_options, registeredHandler) => registeredHandler),
    };
    const registeredHandler = createProcessIngestionRunFunction(handler, client);

    await expect(
      registeredHandler({ event: { data: { runId: "not-a-uuid" } } }),
    ).rejects.toThrow();
    expect(handler.execute).not.toHaveBeenCalled();
  });
});
