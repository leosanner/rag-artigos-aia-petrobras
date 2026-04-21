import { describe, expect, it } from "vitest";

import { parseServerEnv } from "./server";

const baseEnv = {
  DATABASE_URL: "postgres://aia_insight:aia_insight@localhost:5432/aia_insight",
  GOOGLE_DRIVE_FOLDER_ID: "drive-folder-1",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "svc@example.iam.gserviceaccount.com",
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
    "-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----\\n",
  INGESTION_SYNC_SECRET: "server-configured-secret",
  OPENAI_API_KEY: "test-openai-api-key",
  RAG_GENERATION_MODEL: "gpt-4.1-mini",
};

describe("parseServerEnv", () => {
  it("normalizes escaped Google service-account private-key newlines", () => {
    const env = parseServerEnv({
      ...baseEnv,
      NODE_ENV: "test",
    });

    expect(env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).toBe(
      "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n",
    );
  });

  it("rejects missing Inngest credentials in production cloud mode", () => {
    expect(() =>
      parseServerEnv({
        ...baseEnv,
        NODE_ENV: "production",
      }),
    ).toThrow(/INNGEST_EVENT_KEY/);
  });

  it("rejects missing ingestion sync secret outside tests", () => {
    expect(() =>
      parseServerEnv({
        ...baseEnv,
        INGESTION_SYNC_SECRET: undefined,
        NODE_ENV: "production",
        INNGEST_EVENT_KEY: "event-key",
        INNGEST_SIGNING_KEY: "signing-key",
      }),
    ).toThrow(/INGESTION_SYNC_SECRET/);
  });

  it("rejects missing OPENAI_API_KEY outside tests", () => {
    expect(() =>
      parseServerEnv({
        ...baseEnv,
        OPENAI_API_KEY: undefined,
        NODE_ENV: "production",
        INNGEST_EVENT_KEY: "event-key",
        INNGEST_SIGNING_KEY: "signing-key",
      }),
    ).toThrow(/OPENAI_API_KEY/);
  });

  it("rejects missing RAG_GENERATION_MODEL outside tests", () => {
    expect(() =>
      parseServerEnv({
        ...baseEnv,
        RAG_GENERATION_MODEL: undefined,
        NODE_ENV: "production",
        INNGEST_EVENT_KEY: "event-key",
        INNGEST_SIGNING_KEY: "signing-key",
      }),
    ).toThrow(/RAG_GENERATION_MODEL/);
  });

  it("allows tests to omit real Inngest credentials", () => {
    expect(() =>
      parseServerEnv({
        ...baseEnv,
        INGESTION_SYNC_SECRET: undefined,
        NODE_ENV: "test",
      }),
    ).not.toThrow();
  });

  it("allows local Inngest dev mode to omit cloud credentials", () => {
    expect(() =>
      parseServerEnv({
        ...baseEnv,
        NODE_ENV: "development",
        INNGEST_DEV: "1",
      }),
    ).not.toThrow();
  });

  it("accepts production Inngest credentials when cloud mode is active", () => {
    const env = parseServerEnv({
      ...baseEnv,
      NODE_ENV: "production",
      INNGEST_EVENT_KEY: "event-key",
      INNGEST_SIGNING_KEY: "signing-key",
    });

    expect(env.INNGEST_EVENT_KEY).toBe("event-key");
    expect(env.INNGEST_SIGNING_KEY).toBe("signing-key");
  });

  it("defaults RAG_EMBEDDING_MODEL to text-embedding-3-large", () => {
    const env = parseServerEnv({
      ...baseEnv,
      RAG_EMBEDDING_MODEL: undefined,
      NODE_ENV: "production",
      INNGEST_EVENT_KEY: "event-key",
      INNGEST_SIGNING_KEY: "signing-key",
    });

    expect(env.RAG_EMBEDDING_MODEL).toBe("text-embedding-3-large");
  });

  it("defaults RAG_GENERATION_MODEL in tests", () => {
    const env = parseServerEnv({
      ...baseEnv,
      RAG_GENERATION_MODEL: undefined,
      NODE_ENV: "test",
    });

    expect(env.RAG_GENERATION_MODEL).toBe("test-rag-generation-model");
  });
});
