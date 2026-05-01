import { rerank as aiRerank } from "ai";
import { z } from "zod";

import type { RerankingProvider } from "@/application/rag/ports";
import type { FirstPassChunkMatch, RerankedChunkMatch } from "@/domain/rag";
import type { ServerEnv } from "@/env/server";
import { logRagError } from "@/infrastructure/observability/log-rag-error";

const COHERE_RERANKER_PROVIDER_ID = "cohere";
const DEFAULT_COHERE_BASE_URL = "https://api.cohere.com/v2";

export const DEFAULT_COHERE_RERANKING_MODEL = "rerank-v3.5";

const cohereRerankResponseSchema = z.object({
  id: z.string().optional(),
  results: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      relevance_score: z.number(),
    }),
  ),
});

type FetchFn = typeof fetch;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = {
  [key: string]: JsonValue;
};

type CohereRerankCallOptions = {
  documents:
    | {
        type: "text";
        values: string[];
      }
    | {
        type: "object";
        values: JsonObject[];
      };
  query: string;
  topN?: number;
  abortSignal?: AbortSignal;
  headers?: Record<string, string>;
  providerOptions?: Record<string, unknown>;
};

type RerankingModelV3 = {
  specificationVersion: "v3";
  provider: string;
  modelId: string;
  doRerank(options: CohereRerankCallOptions): Promise<{
    ranking: Array<{
      index: number;
      relevanceScore: number;
    }>;
    response?: {
      id?: string;
      timestamp?: Date;
      modelId?: string;
      headers?: Record<string, string>;
    };
  }>;
};

type RerankFn = (input: {
  model: unknown;
  documents: FirstPassChunkMatch[];
  query: string;
  topN?: number;
}) => Promise<{
  ranking: Array<{
    originalIndex: number;
    score: number;
    document: FirstPassChunkMatch;
  }>;
}>;

type CohereRerankingModelFactory = (modelId: string) => RerankingModelV3;

export type CohereRerankingProviderDeps = {
  modelFactory: CohereRerankingModelFactory;
  defaultRerankingModel?: string;
  rerank?: RerankFn;
  nowMs?: () => number;
};

export type CreateRerankingProviderFromEnvDeps = {
  rerank?: RerankFn;
  nowMs?: () => number;
  fetch?: FetchFn;
  baseURL?: string;
};

export type CreateCohereRerankingModelInput = {
  apiKey: string;
  modelId: string;
  fetch?: FetchFn;
  baseURL?: string;
};

export class CohereRerankingProvider implements RerankingProvider {
  private readonly defaultRerankingModel: string;
  private readonly modelFactory: CohereRerankingModelFactory;
  private readonly rerankFn: RerankFn;
  private readonly nowMs: () => number;

  constructor(deps: CohereRerankingProviderDeps) {
    this.defaultRerankingModel =
      deps.defaultRerankingModel ?? DEFAULT_COHERE_RERANKING_MODEL;
    this.modelFactory = deps.modelFactory;
    this.rerankFn = deps.rerank ?? (aiRerank as unknown as RerankFn);
    this.nowMs = deps.nowMs ?? Date.now;
  }

  async rerank(input: {
    question: string;
    matches: FirstPassChunkMatch[];
    topK: number;
    candidateTopK: number;
  }): Promise<{
    matches: RerankedChunkMatch[];
    metadata: {
      rerankerProvider: string;
      rerankerModel: string;
    };
    audit: {
      latencyMs: number;
      candidatesEvaluated: number;
      inputTokens: number;
      estimatedCostUsd: number;
    };
  }> {
    const startedAtMs = this.nowMs();

    try {
      const rankingResult = await this.rerankFn({
        model: this.modelFactory(this.defaultRerankingModel),
        documents: input.matches,
        query: input.question,
        topN: input.topK,
      });

      return {
        matches: rankingResult.ranking
          .slice(0, input.topK)
          .map((item) => toRerankedMatch(input.matches, item)),
        metadata: {
          rerankerProvider: COHERE_RERANKER_PROVIDER_ID,
          rerankerModel: this.defaultRerankingModel,
        },
        audit: {
          latencyMs: Math.max(0, Math.round(this.nowMs() - startedAtMs)),
          candidatesEvaluated: input.matches.length,
          // Cohere rerank billing is search-unit based, so token and USD
          // normalization stay at zero until the project defines a governed
          // conversion policy for those units.
          inputTokens: 0,
          estimatedCostUsd: 0,
        },
      };
    } catch (error) {
      logRagError(
        "ai.reranking_provider_failed",
        {
          provider: COHERE_RERANKER_PROVIDER_ID,
          model: this.defaultRerankingModel,
          candidatesCount: input.matches.length,
          topK: input.topK,
        },
        error,
      );
      throw error;
    }
  }
}

export function createCohereRerankingProviderFromEnv(
  env: Pick<ServerEnv, "COHERE_API_KEY" | "RAG_RERANKER_MODEL">,
  deps: CreateRerankingProviderFromEnvDeps = {},
): CohereRerankingProvider {
  const apiKey = env.COHERE_API_KEY;

  if (!apiKey) {
    throw new Error("COHERE_API_KEY is required to create the reranking provider");
  }

  return new CohereRerankingProvider({
    defaultRerankingModel: env.RAG_RERANKER_MODEL,
    modelFactory: (modelId) =>
      createCohereRerankingModel({
        apiKey,
        modelId,
        fetch: deps.fetch,
        baseURL: deps.baseURL,
      }),
    rerank: deps.rerank,
    nowMs: deps.nowMs,
  });
}

export function createRerankingProviderFromEnv(
  env: Pick<
    ServerEnv,
    "COHERE_API_KEY" | "RAG_RERANKER_MODEL" | "RAG_RERANKER_PROVIDER"
  >,
  deps: CreateRerankingProviderFromEnvDeps = {},
): RerankingProvider | undefined {
  if (!env.RAG_RERANKER_PROVIDER) {
    return undefined;
  }

  if (env.RAG_RERANKER_PROVIDER === COHERE_RERANKER_PROVIDER_ID) {
    return createCohereRerankingProviderFromEnv(env, deps);
  }

  return undefined;
}

export function createCohereRerankingModel(
  input: CreateCohereRerankingModelInput,
): RerankingModelV3 {
  const fetchFn = input.fetch ?? globalThis.fetch;

  return {
    specificationVersion: "v3",
    provider: COHERE_RERANKER_PROVIDER_ID,
    modelId: input.modelId,
    async doRerank(options) {
      const startedAt = new Date();
      const response = await fetchFn(
        `${input.baseURL ?? DEFAULT_COHERE_BASE_URL}/rerank`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${input.apiKey}`,
            "Content-Type": "application/json",
            ...options.headers,
          },
          signal: options.abortSignal,
          body: JSON.stringify({
            model: input.modelId,
            query: options.query,
            documents: toCohereDocuments(options.documents),
            ...(options.topN !== undefined ? { top_n: options.topN } : {}),
          }),
        },
      );

      if (!response.ok) {
        throw await toCohereApiError(response);
      }

      const body = cohereRerankResponseSchema.parse(await response.json());

      return {
        ranking: body.results.map((result) => ({
          index: result.index,
          relevanceScore: result.relevance_score,
        })),
        response: {
          id: body.id,
          timestamp: startedAt,
          modelId: input.modelId,
          headers: Object.fromEntries(response.headers.entries()),
        },
      };
    },
  };
}

function toRerankedMatch(
  candidates: FirstPassChunkMatch[],
  rankingItem: {
    originalIndex: number;
    score: number;
  },
): RerankedChunkMatch {
  const candidate = candidates.at(rankingItem.originalIndex);

  if (!candidate) {
    throw new Error("reranking_provider_returned_unknown_original_index");
  }

  return {
    ...candidate,
    rerankScore: rankingItem.score,
  };
}

function toCohereDocuments(
  documents:
    | {
        type: "text";
        values: string[];
      }
    | {
        type: "object";
        values: JsonObject[];
      },
): string[] {
  if (documents.type === "text") {
    return documents.values;
  }

  return documents.values.map((value) => JSON.stringify(value));
}

async function toCohereApiError(response: Response): Promise<Error> {
  const rawBody = await response.text();
  const parsed = tryParseJson(rawBody);
  const message =
    typeof parsed?.message === "string"
      ? parsed.message
      : response.statusText || "cohere_rerank_failed";
  const error = new Error(message);

  error.name = "CohereRerankingApiError";
  Reflect.set(error, "statusCode", response.status);

  return error;
}

function tryParseJson(value: string): Record<string, unknown> | null {
  if (value.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
