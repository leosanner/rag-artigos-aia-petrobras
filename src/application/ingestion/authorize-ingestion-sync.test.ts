import { describe, expect, it } from "vitest";

import { isAuthorizedIngestionSyncRequest } from "./authorize-ingestion-sync";

describe("isAuthorizedIngestionSyncRequest", () => {
  it("accepts a bearer token matching the configured server secret", () => {
    expect(
      isAuthorizedIngestionSyncRequest(
        "Bearer server-configured-secret",
        "server-configured-secret",
      ),
    ).toBe(true);
  });

  it("rejects missing authorization", () => {
    expect(
      isAuthorizedIngestionSyncRequest(null, "server-configured-secret"),
    ).toBe(false);
  });

  it("rejects non-bearer authorization", () => {
    expect(
      isAuthorizedIngestionSyncRequest(
        "Basic server-configured-secret",
        "server-configured-secret",
      ),
    ).toBe(false);
  });

  it("rejects a wrong bearer token", () => {
    expect(
      isAuthorizedIngestionSyncRequest(
        "Bearer wrong-secret",
        "server-configured-secret",
      ),
    ).toBe(false);
  });

  it("rejects an empty expected secret defensively", () => {
    expect(isAuthorizedIngestionSyncRequest("Bearer anything", "")).toBe(false);
  });
});
