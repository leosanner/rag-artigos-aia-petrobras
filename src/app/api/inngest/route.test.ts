import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProcessIngestionRunHandler } from "@/application/ingestion/ports";

const RUN_ID = "11111111-1111-4111-8111-111111111111";

describe("/api/inngest route", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("inngest/next");
    vi.doUnmock("@/infrastructure/ingestion/inngest");
  });

  it("exports GET, POST, and PUT through serve with the placeholder ingestion function", async () => {
    const routeHandlers = {
      GET: vi.fn(),
      POST: vi.fn(),
      PUT: vi.fn(),
    };
    const processIngestionRunFunction = { id: "process-ingestion-run" };
    const inngestClient = { id: "mock-inngest-client" };
    const registeredHandlers: ProcessIngestionRunHandler[] = [];
    const createProcessIngestionRunFunction = vi.fn(
      (handler: ProcessIngestionRunHandler) => {
        registeredHandlers.push(handler);
        return processIngestionRunFunction;
      },
    );
    const serve = vi.fn(() => routeHandlers);

    vi.doMock("inngest/next", () => ({ serve }));
    vi.doMock("@/infrastructure/ingestion/inngest", () => ({
      createProcessIngestionRunFunction,
      inngest: inngestClient,
    }));

    const route = await import("./route");

    expect(route.GET).toBe(routeHandlers.GET);
    expect(route.POST).toBe(routeHandlers.POST);
    expect(route.PUT).toBe(routeHandlers.PUT);
    expect(createProcessIngestionRunFunction).toHaveBeenCalledOnce();
    expect(serve).toHaveBeenCalledWith({
      client: inngestClient,
      functions: [processIngestionRunFunction],
    });

    const handler = registeredHandlers[0];
    if (handler === undefined) {
      throw new Error("Expected the route to register a process handler");
    }

    let thrown: unknown;
    try {
      await handler.execute(RUN_ID);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown).toHaveProperty("name", "IngestionError");
    expect(thrown).toHaveProperty("code", "unknown_error");
    expect(thrown).toHaveProperty("message", expect.stringContaining(RUN_ID));
  });
});
