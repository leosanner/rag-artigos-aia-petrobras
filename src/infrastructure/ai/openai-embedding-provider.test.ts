import { describe, expect, it, vi } from "vitest";

import {
  EmbeddingProviderError,
  OpenAiEmbeddingProvider,
} from "./openai-embedding-provider";

const MODEL = "text-embedding-3-large";
const EMBEDDING_DIMENSIONS = 3072;

function vector(value: number): number[] {
  return Array.from({ length: EMBEDDING_DIMENSIONS }, () => value);
}

describe("OpenAiEmbeddingProvider", () => {
  it("embeds many texts through the configured OpenAI model", async () => {
    const model = { provider: "openai", modelId: MODEL };
    const modelFactory = vi.fn().mockReturnValue(model);
    const embedMany = vi.fn().mockResolvedValue({
      embeddings: [vector(0.1), vector(0.2)],
      usage: { tokens: 44 },
    });
    const provider = new OpenAiEmbeddingProvider({
      model: MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      modelFactory,
      embedMany,
    });

    await expect(provider.embedMany(["a", "b"])).resolves.toEqual([
      vector(0.1),
      vector(0.2),
    ]);
    expect(modelFactory).toHaveBeenCalledWith(MODEL);
    expect(embedMany).toHaveBeenCalledWith({
      model,
      values: ["a", "b"],
    });
  });

  it("embeds a single question with normalized usage and estimated cost", async () => {
    const model = { provider: "openai", modelId: MODEL };
    const modelFactory = vi.fn().mockReturnValue(model);
    const embedMany = vi.fn().mockResolvedValue({
      embeddings: [vector(0.3)],
      usage: { tokens: 1234 },
    });
    const provider = new OpenAiEmbeddingProvider({
      model: MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      modelFactory,
      embedMany,
    });

    await expect(
      provider.embedQuestion("what does the paper say?"),
    ).resolves.toEqual({
      embedding: vector(0.3),
      usage: {
        inputTokens: 1234,
        estimatedCostUsd: 0.00016042,
      },
    });
    expect(modelFactory).toHaveBeenCalledWith(MODEL);
    expect(embedMany).toHaveBeenCalledWith({
      model,
      values: ["what does the paper say?"],
    });
  });

  it("returns zero cost for unknown or test embedding models", async () => {
    const provider = new OpenAiEmbeddingProvider({
      model: "test-embedding-model",
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      modelFactory: vi.fn().mockReturnValue({}),
      embedMany: vi.fn().mockResolvedValue({
        embeddings: [vector(0.5)],
        usage: { tokens: 987 },
      }),
    });

    await expect(provider.embedQuestion("Pergunta")).resolves.toEqual({
      embedding: vector(0.5),
      usage: {
        inputTokens: 987,
        estimatedCostUsd: 0,
      },
    });
  });

  it("fails with a safe adapter error when any returned vector has the wrong dimension", async () => {
    const provider = new OpenAiEmbeddingProvider({
      model: MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      modelFactory: vi.fn().mockReturnValue({}),
      embedMany: vi.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
        usage: { tokens: 3 },
      }),
    });

    await expect(provider.embedMany(["a"])).rejects.toMatchObject(
      new EmbeddingProviderError("embedding_dimensions_mismatch"),
    );
  });

  it("wraps raw provider failures without leaking provider details", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const provider = new OpenAiEmbeddingProvider({
      model: MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      modelFactory: vi.fn().mockReturnValue({}),
      embedMany: vi.fn().mockRejectedValue(new Error("secret provider detail")),
    });

    await expect(provider.embedMany(["a"])).rejects.toMatchObject(
      new EmbeddingProviderError("embedding_failed"),
    );

    const payload = JSON.parse(errorSpy.mock.calls[0]![0] as string) as Record<
      string,
      unknown
    >;
    expect(payload.event).toBe("ai.embedding_provider_failed");
    expect(payload.model).toBe(MODEL);
    errorSpy.mockRestore();
  });
});
