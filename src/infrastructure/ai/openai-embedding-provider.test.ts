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

  it("fails with a safe adapter error when any returned vector has the wrong dimension", async () => {
    const provider = new OpenAiEmbeddingProvider({
      model: MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      modelFactory: vi.fn().mockReturnValue({}),
      embedMany: vi.fn().mockResolvedValue({
        embeddings: [[0.1, 0.2, 0.3]],
      }),
    });

    await expect(provider.embedMany(["a"])).rejects.toMatchObject(
      new EmbeddingProviderError("embedding_dimensions_mismatch"),
    );
  });

  it("wraps raw provider failures without leaking provider details", async () => {
    const provider = new OpenAiEmbeddingProvider({
      model: MODEL,
      embeddingDimensions: EMBEDDING_DIMENSIONS,
      modelFactory: vi.fn().mockReturnValue({}),
      embedMany: vi.fn().mockRejectedValue(new Error("secret provider detail")),
    });

    await expect(provider.embedMany(["a"])).rejects.toMatchObject(
      new EmbeddingProviderError("embedding_failed"),
    );
  });
});
