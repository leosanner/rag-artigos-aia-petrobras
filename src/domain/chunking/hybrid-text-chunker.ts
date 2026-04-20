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

const ESTIMATED_TOKEN_PATTERN = /[\p{L}\p{N}]+|[/:+()[\]{}<>=%&*-]/gu;

export function estimateTokens(text: string): number {
  return findEstimatedTokenSpans(text).length;
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

      const candidate: string = `${current}\n\n${paragraph}`;
      if (estimateTokens(candidate) <= this.config.maxEstimatedTokens) {
        current = candidate;
        continue;
      }

      const maxOverlapTokens = Math.min(
        this.config.overlapEstimatedTokens,
        this.config.maxEstimatedTokens - paragraphTokens,
      );
      const overlap = takeTrailingEstimatedTokens(
        current,
        maxOverlapTokens,
      );
      flushCurrent();
      current = overlap.length > 0 ? `${overlap}\n\n${paragraph}` : paragraph;
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
  const tokenSpans = findEstimatedTokenSpans(text);
  const chunks: string[] = [];
  const step = config.maxEstimatedTokens - config.overlapEstimatedTokens;

  for (let start = 0; start < tokenSpans.length; start += step) {
    const end = Math.min(start + config.maxEstimatedTokens, tokenSpans.length);
    const chunk = sliceEstimatedTokenRange(text, tokenSpans, start, end);
    if (chunk.length === 0) {
      break;
    }
    chunks.push(chunk);
    if (end >= tokenSpans.length) {
      break;
    }
  }

  return chunks;
}

function takeTrailingEstimatedTokens(text: string, count: number): string {
  if (count === 0) {
    return "";
  }
  const tokenSpans = findEstimatedTokenSpans(text);
  const start = Math.max(tokenSpans.length - count, 0);
  return sliceEstimatedTokenRange(text, tokenSpans, start, tokenSpans.length);
}

type EstimatedTokenSpan = {
  start: number;
  end: number;
};

function findEstimatedTokenSpans(text: string): EstimatedTokenSpan[] {
  return Array.from(text.matchAll(ESTIMATED_TOKEN_PATTERN), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function sliceEstimatedTokenRange(
  text: string,
  tokenSpans: EstimatedTokenSpan[],
  start: number,
  end: number,
): string {
  if (start >= end) {
    return "";
  }

  const firstToken = tokenSpans[start];
  const nextToken = tokenSpans[end];
  if (!firstToken) {
    return "";
  }

  return text.slice(firstToken.start, nextToken?.start ?? text.length).trim();
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
