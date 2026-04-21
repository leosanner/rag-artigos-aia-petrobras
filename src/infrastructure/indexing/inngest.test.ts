import { describe, expect, it, vi } from "vitest";

import {
  createProcessIndexingRunFunction,
  InngestIndexingEventPublisher,
  RAG_INDEXING_REQUESTED_EVENT,
} from "./inngest";

const RUN_ID = "11111111-1111-4111-8111-111111111111";

describe("InngestIndexingEventPublisher", () => {
  it("publishes rag/indexing.requested with a validated run id", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const publisher = new InngestIndexingEventPublisher({ send });

    await publisher.publishIndexingRequested(RUN_ID);

    expect(send).toHaveBeenCalledWith({
      name: RAG_INDEXING_REQUESTED_EVENT,
      data: { runId: RUN_ID },
    });
  });

  it("rejects invalid run ids before sending an event", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const publisher = new InngestIndexingEventPublisher({ send });

    await expect(publisher.publishIndexingRequested("not-a-uuid")).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
  });
});

describe("createProcessIndexingRunFunction", () => {
  it("parses the event and calls the process handler", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const createFunction = vi.fn((_options, handler) => handler);

    const fn = createProcessIndexingRunFunction(
      { execute },
      { createFunction },
    );

    await fn({ event: { data: { runId: RUN_ID } } });

    expect(createFunction).toHaveBeenCalledWith(
      {
        id: "process-indexing-run",
        name: "Process indexing run",
        triggers: { event: RAG_INDEXING_REQUESTED_EVENT },
      },
      expect.any(Function),
    );
    expect(execute).toHaveBeenCalledWith(RUN_ID);
  });

  it("rejects invalid event payloads before calling the process handler", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const createFunction = vi.fn((_options, handler) => handler);

    const fn = createProcessIndexingRunFunction(
      { execute },
      { createFunction },
    );

    await expect(
      fn({ event: { data: { runId: "not-a-uuid" } } }),
    ).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });
});
