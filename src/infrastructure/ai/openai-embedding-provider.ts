import { openai } from "@ai-sdk/openai";
import { embedMany as aiEmbedMany } from "ai";

import type { EmbeddingProvider } from "@/application/indexing/ports";
import type { QuestionEmbeddingProvider } from "@/application/rag/ports";
import { IndexingError, type IndexingErrorCode } from "@/domain/indexing/errors";
import type { ServerEnv } from "@/env/server";
import { logRagError } from "@/infrastructure/observability/log-rag-error";

import { estimateOpenAiEmbeddingCostUsd } from "./openai-pricing";

type EmbedManyFn = (input: {
  model: unknown;
  values: string[];
}) => Promise<{
  embeddings: number[][];
  usage?: {
    tokens: number;
  };
}>;

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

export class OpenAiEmbeddingProvider
  implements EmbeddingProvider, QuestionEmbeddingProvider
{
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
    const { embeddings } = await this.embedWithUsage(texts);
    return embeddings;
  }

  async embedQuestion(question: string): Promise<{
    embedding: number[];
    usage: {
      inputTokens: number;
      estimatedCostUsd: number;
    };
  }> {
    const { embeddings, usage } = await this.embedWithUsage([question]);
    const [embedding] = embeddings;

    if (embedding === undefined) {
      throw new EmbeddingProviderError("embedding_dimensions_mismatch");
    }

    const inputTokens = usage?.tokens ?? 0;

    return {
      embedding,
      usage: {
        inputTokens,
        estimatedCostUsd: estimateOpenAiEmbeddingCostUsd(this.model, inputTokens),
      },
    };
  }

  private async embedWithUsage(texts: string[]): Promise<{
    embeddings: number[][];
    usage?: {
      tokens: number;
    };
  }> {
    let result: {
      embeddings: number[][];
      usage?: {
        tokens: number;
      };
    };

    try {
      result = await this.embedManyFn({
        model: this.modelFactory(this.model),
        values: texts,
      });
    } catch (error) {
      logRagError(
        "ai.embedding_provider_failed",
        { model: this.model, valuesCount: texts.length },
        error,
      );
      throw new EmbeddingProviderError("embedding_failed");
    }

    for (const embedding of result.embeddings) {
      if (embedding.length !== this.embeddingDimensions) {
        throw new EmbeddingProviderError("embedding_dimensions_mismatch");
      }
    }

    return result;
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
