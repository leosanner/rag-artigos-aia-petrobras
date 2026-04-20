import { openai } from "@ai-sdk/openai";
import { embedMany as aiEmbedMany } from "ai";

import type { EmbeddingProvider } from "@/application/indexing/ports";
import { IndexingError, type IndexingErrorCode } from "@/domain/indexing/errors";
import type { ServerEnv } from "@/env/server";

type EmbedManyFn = (input: {
  model: unknown;
  values: string[];
}) => Promise<{ embeddings: number[][] }>;

type ModelFactory = (model: string) => unknown;

export class EmbeddingProviderError extends IndexingError {
  constructor(
    code: Extract<
      IndexingErrorCode,
      "embedding_failed" | "embedding_dimensions_mismatch"
    >,
  ) {
    super(code, code);
    this.name = "EmbeddingProviderError";
  }
}

export type OpenAiEmbeddingProviderDeps = {
  model: string;
  embeddingDimensions: number;
  modelFactory?: ModelFactory;
  embedMany?: EmbedManyFn;
};

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private readonly model: string;
  private readonly embeddingDimensions: number;
  private readonly modelFactory: ModelFactory;
  private readonly embedManyFn: EmbedManyFn;

  constructor(deps: OpenAiEmbeddingProviderDeps) {
    this.model = deps.model;
    this.embeddingDimensions = deps.embeddingDimensions;
    this.modelFactory =
      deps.modelFactory ?? ((model) => openai.embedding(model));
    this.embedManyFn = deps.embedMany ?? (aiEmbedMany as unknown as EmbedManyFn);
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    let embeddings: number[][];
    try {
      const result = await this.embedManyFn({
        model: this.modelFactory(this.model),
        values: texts,
      });
      embeddings = result.embeddings;
    } catch {
      throw new EmbeddingProviderError("embedding_failed");
    }

    for (const embedding of embeddings) {
      if (embedding.length !== this.embeddingDimensions) {
        throw new EmbeddingProviderError("embedding_dimensions_mismatch");
      }
    }

    return embeddings;
  }
}

export function createOpenAiEmbeddingProviderFromEnv(
  env: Pick<ServerEnv, "RAG_EMBEDDING_MODEL">,
): OpenAiEmbeddingProvider {
  return new OpenAiEmbeddingProvider({
    model: env.RAG_EMBEDDING_MODEL,
    embeddingDimensions: 3072,
  });
}
