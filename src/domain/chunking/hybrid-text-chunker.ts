export type ChunkingConfig = {
  chunkingVersion: string;
  maxEstimatedTokens: number;
  overlapEstimatedTokens: number;
};

export type ChunkedText = {
  chunkIndex: number;
  content: string;
  estimatedTokens: number;
};

export type TextChunkerInput = {
  refinedText: string;
};

export interface TextChunker {
  chunk(input: TextChunkerInput): ChunkedText[];
}

export const DEFAULT_CHUNKING_CONFIG = {
  chunkingVersion: "hybrid-v1-900-150",
  maxEstimatedTokens: 900,
  overlapEstimatedTokens: 150,
} satisfies ChunkingConfig;

export class ChunkingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChunkingError";
  }
}

export function estimateTokens(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]+|[/:+()[\]{}<>=%&*-]/gu);
  return matches?.length ?? 0;
}

export class HybridTextChunker implements TextChunker {
  private readonly config: ChunkingConfig;

  constructor(config: ChunkingConfig = DEFAULT_CHUNKING_CONFIG) {
    assertPositiveInteger(config.maxEstimatedTokens, "maxEstimatedTokens");
    assertNonNegativeInteger(
      config.overlapEstimatedTokens,
      "overlapEstimatedTokens",
    );
    if (config.overlapEstimatedTokens >= config.maxEstimatedTokens) {
      throw new ChunkingError(
        "overlapEstimatedTokens must be lower than maxEstimatedTokens",
      );
    }
    this.config = config;
  }

  chunk(input: TextChunkerInput): ChunkedText[] {
    const normalized = normalizeRefinedText(input.refinedText);
    if (normalized.length === 0) {
      throw new ChunkingError("refined_text must be non-empty");
    }

    const paragraphs = splitParagraphs(normalized);
    const chunks: string[] = [];
    let current: string | null = null;

    const flushCurrent = () => {
      if (current !== null && current.trim().length > 0) {
        chunks.push(current.trim());
      }
      current = null;
    };

    for (const paragraph of paragraphs) {
      const paragraphTokens = estimateTokens(paragraph);

      if (paragraphTokens > this.config.maxEstimatedTokens) {
        flushCurrent();
        chunks.push(...splitLongText(paragraph, this.config));
        continue;
      }

      if (current === null) {
        current = paragraph;
        continue;
      }

      const candidate = `${current}\n\n${paragraph}`;
      if (estimateTokens(candidate) <= this.config.maxEstimatedTokens) {
        current = candidate;
        continue;
      }

      const overlap = takeTrailingEstimatedTokens(
        current,
        this.config.overlapEstimatedTokens,
      );
      flushCurrent();
      current =
        overlap.length > 0 ? `${overlap}\n\n${paragraph}` : paragraph;
    }

    flushCurrent();

    return chunks.map((content, index) => ({
      chunkIndex: index,
      content,
      estimatedTokens: estimateTokens(content),
    }));
  }
}

function normalizeRefinedText(text: string): string {
  return splitParagraphs(text)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, " ").trim())
    .filter((paragraph) => paragraph.length > 0)
    .join("\n\n");
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

function splitLongText(text: string, config: ChunkingConfig): string[] {
  const tokens = tokenizeForSplitting(text);
  const chunks: string[] = [];
  const step = config.maxEstimatedTokens - config.overlapEstimatedTokens;

  for (let start = 0; start < tokens.length; start += step) {
    const slice = tokens.slice(start, start + config.maxEstimatedTokens);
    if (slice.length === 0) {
      break;
    }
    chunks.push(slice.join(" "));
    if (start + config.maxEstimatedTokens >= tokens.length) {
      break;
    }
  }

  return chunks;
}

function takeTrailingEstimatedTokens(text: string, count: number): string {
  if (count === 0) {
    return "";
  }
  const tokens = tokenizeForSplitting(text);
  return tokens.slice(Math.max(tokens.length - count, 0)).join(" ");
}

function tokenizeForSplitting(text: string): string[] {
  return text.match(/[\p{L}\p{N}]+|[/:+()[\]{}<>=%&*-]/gu) ?? [];
}

function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ChunkingError(`${fieldName} must be a positive integer`);
  }
}

function assertNonNegativeInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new ChunkingError(`${fieldName} must be a non-negative integer`);
  }
}
