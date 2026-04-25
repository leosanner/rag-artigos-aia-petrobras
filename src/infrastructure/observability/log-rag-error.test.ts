import { afterEach, describe, expect, it, vi } from "vitest";

import { logRagError } from "./log-rag-error";

describe("logRagError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a single console.error line with parseable JSON payload", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logRagError("answer.retrieval_failed", { requestTraceId: "abc12345" }, new Error("boom"));

    expect(spy).toHaveBeenCalledTimes(1);
    const [arg] = spy.mock.calls[0]!;
    expect(typeof arg).toBe("string");
    const payload = JSON.parse(arg as string) as Record<string, unknown>;
    expect(payload.level).toBe("error");
    expect(payload.scope).toBe("rag");
    expect(payload.event).toBe("answer.retrieval_failed");
    expect(payload.requestTraceId).toBe("abc12345");
  });

  it("captures Error name, message and stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new TypeError("kapow");

    logRagError("ai.embedding_provider_failed", {}, err);

    const payload = JSON.parse(spy.mock.calls[0]![0] as string) as Record<string, unknown>;
    const error = payload.error as Record<string, unknown>;
    expect(error.name).toBe("TypeError");
    expect(error.message).toBe("kapow");
    expect(typeof error.stack).toBe("string");
  });

  it("extracts statusCode (or status) via Reflect.get", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = Object.assign(new Error("rate limited"), { statusCode: 429 });

    logRagError("ai.generation_provider_failed", { model: "gpt-x" }, err);

    const payload = JSON.parse(spy.mock.calls[0]![0] as string) as Record<string, unknown>;
    const error = payload.error as Record<string, unknown>;
    expect(error.statusCode).toBe(429);
    expect(payload.model).toBe("gpt-x");
  });

  it("captures error cause when present", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const root = new Error("root");
    const wrapped = new Error("outer", { cause: root });

    logRagError("retrieval.pgvector_query_failed", {}, wrapped);

    const payload = JSON.parse(spy.mock.calls[0]![0] as string) as Record<string, unknown>;
    const error = payload.error as Record<string, unknown>;
    const cause = error.cause as Record<string, unknown>;
    expect(cause.message).toBe("root");
  });

  it("handles non-Error throwables", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    logRagError("handler.append_message_failed", {}, "weird string");

    const payload = JSON.parse(spy.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(payload.error).toEqual({ value: "weird string" });
  });
});
