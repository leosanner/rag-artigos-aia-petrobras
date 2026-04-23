type OpenAiEmbeddingPricing = {
  modelPrefix: string;
  costPerMillionTokensUsd: number;
};

type OpenAiGenerationPricing = {
  modelPrefix: string;
  inputCostPerMillionTokensUsd: number;
  cachedInputCostPerMillionTokensUsd: number;
  outputCostPerMillionTokensUsd: number;
};

const OPENAI_EMBEDDING_PRICING: readonly OpenAiEmbeddingPricing[] = [
  {
    modelPrefix: "text-embedding-3-large",
    costPerMillionTokensUsd: 0.13,
  },
];

const OPENAI_GENERATION_PRICING: readonly OpenAiGenerationPricing[] = [
  {
    modelPrefix: "gpt-4.1-mini",
    inputCostPerMillionTokensUsd: 0.4,
    cachedInputCostPerMillionTokensUsd: 0.1,
    outputCostPerMillionTokensUsd: 1.6,
  },
];

export function estimateOpenAiEmbeddingCostUsd(
  model: string,
  inputTokens: number,
): number {
  const pricing = OPENAI_EMBEDDING_PRICING.find((entry) =>
    model.startsWith(entry.modelPrefix),
  );

  if (!pricing) {
    return 0;
  }

  return roundUsd(
    (Math.max(0, inputTokens) * pricing.costPerMillionTokensUsd) / 1_000_000,
  );
}

export function estimateOpenAiGenerationCostUsd(input: {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}): number {
  const pricing = OPENAI_GENERATION_PRICING.find((entry) =>
    input.model.startsWith(entry.modelPrefix),
  );

  if (!pricing) {
    return 0;
  }

  const inputTokens = Math.max(0, input.inputTokens);
  const cachedInputTokens = Math.min(
    inputTokens,
    Math.max(0, input.cachedInputTokens),
  );
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
  const outputTokens = Math.max(0, input.outputTokens);

  return roundUsd(
    (uncachedInputTokens * pricing.inputCostPerMillionTokensUsd +
      cachedInputTokens * pricing.cachedInputCostPerMillionTokensUsd +
      outputTokens * pricing.outputCostPerMillionTokensUsd) /
      1_000_000,
  );
}

function roundUsd(value: number): number {
  return Number(value.toFixed(12));
}
