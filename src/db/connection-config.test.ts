import { describe, expect, it } from "vitest";

import {
  buildPoolConfig,
  normalizePgConnectionString,
} from "./connection-config";

describe("normalizePgConnectionString", () => {
  it("normalizes sslmode=require to verify-full to avoid pg parser warnings", () => {
    expect(
      normalizePgConnectionString(
        "postgres://user:pass@example.com/db?sslmode=require",
      ),
    ).toBe("postgres://user:pass@example.com/db?sslmode=verify-full");
  });

  it("preserves explicit libpq compatibility mode", () => {
    expect(
      normalizePgConnectionString(
        "postgres://user:pass@example.com/db?sslmode=require&uselibpqcompat=true",
      ),
    ).toBe(
      "postgres://user:pass@example.com/db?sslmode=require&uselibpqcompat=true",
    );
  });

  it("preserves unrelated query params while normalizing sslmode", () => {
    expect(
      normalizePgConnectionString(
        "postgres://user:pass@example.com/db?sslmode=prefer&connect_timeout=15",
      ),
    ).toBe(
      "postgres://user:pass@example.com/db?sslmode=verify-full&connect_timeout=15",
    );
  });
});

describe("buildPoolConfig", () => {
  it("uses SSL outside development", () => {
    expect(
      buildPoolConfig("postgres://user:pass@example.com/db", "production").ssl,
    ).toBe(true);
  });

  it("disables SSL in development", () => {
    expect(
      buildPoolConfig("postgres://user:pass@example.com/db", "development").ssl,
    ).toBe(false);
  });
});
