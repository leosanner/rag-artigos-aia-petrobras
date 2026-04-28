import { createOpenAI, openai } from "@ai-sdk/openai";
import {
  generateText as aiGenerateText,
  streamText as aiStreamText,
} from "ai";

import type {
  GenerateAnswerInput,
  GenerationProvider,
  StreamAnswerInput,
} from "@/application/rag/ports";
import {
  GenerationFailure,
  buildNoEvidenceAnswer,
  type RagRetrievalStrategy,
} from "@/domain/rag";
import type { ServerEnv } from "@/env/server";
import { logRagError } from "@/infrastructure/observability/log-rag-error";

import { estimateOpenAiGenerationCostUsd } from "./openai-pricing";

type GenerateTextFn = (input: {
  model: unknown;
  system: string;
  prompt: string;
}) => Promise<{
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    inputTokenDetails?: {
      cacheReadTokens?: number;
    };
  };
}>;

type StreamTextFn = (input: {
  model: unknown;
  system: string;
  prompt: string;
}) => {
  textStream: AsyncIterable<string>;
  usage: PromiseLike<{
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    inputTokenDetails?: {
      cacheReadTokens?: number;
    };
  }>;
  text: PromiseLike<string>;
};

type ModelFactory = (model: string) => unknown;
type OpenAiProviderFactory = (options?: { apiKey?: string }) => {
  chat(modelId: string): unknown;
};

export type OpenAiGenerationProviderDeps = {
  defaultGenerationModel?: string;
  modelFactory?: ModelFactory;
  generateText?: GenerateTextFn;
  streamText?: StreamTextFn;
};

export type OpenAiGenerationProviderFactoryDeps = {
  createProvider?: OpenAiProviderFactory;
  generateText?: GenerateTextFn;
  streamText?: StreamTextFn;
};

export class OpenAiGenerationProvider implements GenerationProvider {
  private readonly defaultGenerationModel?: string;
  private readonly modelFactory: ModelFactory;
  private readonly generateTextFn: GenerateTextFn;
  private readonly streamTextFn: StreamTextFn;

  constructor(deps: OpenAiGenerationProviderDeps = {}) {
    this.defaultGenerationModel = deps.defaultGenerationModel;
    this.modelFactory = deps.modelFactory ?? ((model) => openai.chat(model));
    this.generateTextFn =
      deps.generateText ?? (aiGenerateText as unknown as GenerateTextFn);
    this.streamTextFn =
      deps.streamText ?? (aiStreamText as unknown as StreamTextFn);
  }

  async generateAnswer(input: GenerateAnswerInput): Promise<{
    answer: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostUsd: number;
    };
  }> {
    const generationModel =
      input.generationModel || this.defaultGenerationModel;

    if (!generationModel) {
      throw new GenerationFailure(
        "generation_failed",
        "generation_failed",
      );
    }

    try {
      const result = await this.generateTextFn({
        model: this.modelFactory(generationModel),
        system: buildSystemPrompt(input.promptVersion, input.retrievalStrategy),
        prompt: buildUserPrompt(
          input.question,
          input.promptContext,
          input.conversationContext,
        ),
      });

      const answer = result.text.trim();
      if (answer.length === 0) {
        throw new GenerationFailure("generation_failed", "generation_failed");
      }

      return {
        answer,
        usage: toGenerationUsage(generationModel, result.usage ?? {}),
      };
    } catch (error) {
      logRagError(
        "ai.generation_provider_failed",
        {
          model: generationModel,
          promptVersion: input.promptVersion,
          retrievalStrategy: input.retrievalStrategy,
        },
        error,
      );
      throw new GenerationFailure(
        classifyGenerationFailure(error),
        classifyGenerationFailure(error),
      );
    }
  }

  async streamAnswer(input: StreamAnswerInput): Promise<{
    answer: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostUsd: number;
    };
  }> {
    const generationModel =
      input.generationModel || this.defaultGenerationModel;

    if (!generationModel) {
      throw new GenerationFailure(
        "generation_failed",
        "generation_failed",
      );
    }

    try {
      const result = this.streamTextFn({
        model: this.modelFactory(generationModel),
        system: buildSystemPrompt(input.promptVersion, input.retrievalStrategy),
        prompt: buildUserPrompt(
          input.question,
          input.promptContext,
          input.conversationContext,
        ),
      });

      let answer = "";

      for await (const textDelta of result.textStream) {
        if (textDelta.length === 0) {
          continue;
        }

        answer += textDelta;
        await input.onTextDelta?.(textDelta);
      }

      const usage = await result.usage;
      const trimmedAnswer = answer.trim();

      if (trimmedAnswer.length === 0) {
        throw new GenerationFailure("generation_failed", "generation_failed");
      }

      return {
        answer: trimmedAnswer,
        usage: toGenerationUsage(generationModel, usage),
      };
    } catch (error) {
      logRagError(
        "ai.generation_provider_stream_failed",
        {
          model: generationModel,
          promptVersion: input.promptVersion,
          retrievalStrategy: input.retrievalStrategy,
        },
        error,
      );
      throw new GenerationFailure(
        classifyGenerationFailure(error),
        classifyGenerationFailure(error),
      );
    }
  }
}

export function createOpenAiGenerationProviderFromEnv(
  env: Pick<ServerEnv, "OPENAI_API_KEY" | "RAG_GENERATION_MODEL">,
  deps: OpenAiGenerationProviderFactoryDeps = {},
): OpenAiGenerationProvider {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required to create the generation provider");
  }

  const createProvider = deps.createProvider ?? createOpenAI;
  const provider = createProvider({ apiKey: env.OPENAI_API_KEY });

  return new OpenAiGenerationProvider({
    defaultGenerationModel: env.RAG_GENERATION_MODEL,
    modelFactory: (model) => provider.chat(model),
    generateText: deps.generateText,
    streamText: deps.streamText,
  });
}

function buildSystemPrompt(
  promptVersion: string,
  retrievalStrategy: RagRetrievalStrategy,
): string {
  const baseInstructions = [
    `Versão do prompt: ${promptVersion}`,
    "Você é um assistente de RAG para uma base de artigos científicos.",
    "Responda sempre em português do Brasil.",
    "Use apenas o contexto numerado fornecido como base factual da resposta.",
    "Toda afirmação factual apoiada nas fontes deve usar marcadores inline no formato [n].",
    "Nunca invente fontes, trechos ou citações.",
    `Se o contexto não sustentar a resposta, responda exatamente com: "${buildNoEvidenceAnswer()}".`,
  ];

  if (retrievalStrategy === "explore") {
    baseInstructions.push(
      "No modo explore, apresente 2 a 4 perspectivas ou facetas em uma única resposta e cite cada perspectiva com pelo menos uma fonte inline.",
    );
  }

  return baseInstructions.join("\n");
}

function buildUserPrompt(
  question: string,
  promptContext: string,
  conversationContext?: {
    transcript: string;
  },
): string {
  const sections =
    conversationContext === undefined
      ? [`Pergunta:\n${question}`]
      : [
          `Historico da conversa:\n${conversationContext.transcript}`,
          `Pergunta atual:\n${question}`,
        ];

  sections.push(`Contexto numerado:\n${promptContext}`);

  return sections.join("\n\n");
}

function classifyGenerationFailure(error: unknown) {
  if (error instanceof GenerationFailure) {
    return error.code;
  }

  const statusCode = extractStatusCode(error);
  if (statusCode !== null) {
    if (statusCode === 429 || statusCode >= 500) {
      return "generation_unavailable";
    }

    return "generation_failed";
  }

  const message = extractMessage(error).toLowerCase();
  if (
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("temporarily unavailable") ||
    message.includes("service unavailable") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout")
  ) {
    return "generation_unavailable";
  }

  return "generation_failed";
}

function toGenerationUsage(
  generationModel: string,
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    inputTokenDetails?: {
      cacheReadTokens?: number;
    };
  },
) {
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const totalTokens = usage.totalTokens ?? inputTokens + outputTokens;
  const cachedInputTokens = usage.inputTokenDetails?.cacheReadTokens ?? 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCostUsd: estimateOpenAiGenerationCostUsd({
      model: generationModel,
      inputTokens,
      cachedInputTokens,
      outputTokens,
    }),
  };
}

function extractStatusCode(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const value = Reflect.get(error, "statusCode") ?? Reflect.get(error, "status");
  return typeof value === "number" ? value : null;
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error !== "object" || error === null) {
    return "";
  }

  const value = Reflect.get(error, "message");
  return typeof value === "string" ? value : "";
}
